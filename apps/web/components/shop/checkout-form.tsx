'use client';

import {
  IDEMPOTENCY_HEADER,
  PAYMENT_METHOD_LABELS,
  paymentOptions,
  type AddressDTO,
  type ApiResponse,
  type CustomerOrderDTO,
  type DeliveryAreaDTO,
  type PaymentMethod,
  type PricedCart,
  type PublicSettingsDTO,
} from '@aricon/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, newIdempotencyKey } from '@/lib/api-client';
import { errorMessage, isApiError } from '@/lib/api-errors';
import { useCart } from '@/lib/cart/cart-context';
import { cartQueryKeys } from '@/lib/cart/keys';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { AddAddressForm } from './add-address-form';
import { BankDetails } from './bank-details';
import { OrderSummary } from './order-summary';
import { PaymentMethodCard } from './payment-method-card';
import { Skeleton } from './skeleton';
import { CARD_CLASS } from './styles';

export interface CheckoutFormProps {
  areas: DeliveryAreaDTO[];
  settings: PublicSettingsDTO;
  initialAddresses: AddressDTO[];
}

const NOTE_MAX = 500;

/** The fresh cart the API sends with `PRICE_CHANGED` / `OUT_OF_STOCK` (SPEC §6.6), if any. */
function cartFromError(error: unknown): PricedCart | null {
  if (!isApiError(error) || typeof error.details !== 'object' || error.details === null) return null;
  const cart = (error.details as { cart?: unknown }).cart;
  return typeof cart === 'object' && cart !== null && Array.isArray((cart as PricedCart).lines) ? (cart as PricedCart) : null;
}

/**
 * Single-page checkout (SPEC §8.7): address, payment method, review + note, then "Place order"
 * (`POST /api/orders`, SPEC §6.6). The delivery fee always follows the *chosen address's* area
 * (SPEC §6.4), so selecting an address reprices the cart for that area.
 *
 * One `Idempotency-Key` per checkout visit: a double click or a retry after a network error returns
 * the same order instead of placing a second one. The total the customer saw goes along as
 * `expectedTotal`; if prices moved meanwhile the API answers `PRICE_CHANGED` with the new cart,
 * which replaces the old one on screen.
 */
export function CheckoutForm({ areas, settings, initialAddresses }: CheckoutFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { pricedCart, areaId, setAreaId, ready, clear } = useCart();
  const [idempotencyKey] = useState(newIdempotencyKey);

  const [addresses, setAddresses] = useState<AddressDTO[]>(initialAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    initialAddresses.find((address) => address.isDefault)?.id ?? initialAddresses[0]?.id ?? null,
  );
  const [showAddAddress, setShowAddAddress] = useState(initialAddresses.length === 0);
  const [chosenMethod, setChosenMethod] = useState<PaymentMethod | null>(null);
  const [customerNote, setCustomerNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** Set once the order exists: the emptied cart must not send the customer back to the cart page. */
  const [placed, setPlaced] = useState(false);

  const selectedAddress = addresses.find((address) => address.id === selectedAddressId) ?? null;

  // Checkout always prices delivery using the chosen address's area, not whatever estimate area
  // the shopper had picked while browsing (SPEC §6.4).
  useEffect(() => {
    if (selectedAddress?.areaServiceable && areaId !== selectedAddress.areaId) {
      setAreaId(selectedAddress.areaId);
    }
  }, [selectedAddress, areaId, setAreaId]);

  // A stale, empty or blocked cart (out of stock, unavailable item...) shouldn't reach checkout —
  // send the shopper back to fix it there. An unserviceable area is handled inline below instead,
  // because it depends on which address is selected, not on the cart's items.
  useEffect(() => {
    if (!ready || placed) return;
    const blocked = pricedCart.issues.some((issue) => issue.code !== 'AREA_NOT_SERVICEABLE');
    if (blocked) router.replace(routes.cart);
  }, [ready, placed, pricedCart.issues, router]);

  const options = useMemo(() => paymentOptions(settings, pricedCart.total), [settings, pricedCart.total]);

  // The shopper's choice while it's still offered, otherwise the first available method — e.g. COD
  // drops out when the delivery fee pushes the total over the COD limit.
  const paymentMethod =
    options.find((option) => option.method === chosenMethod && option.available)?.method ??
    options.find((option) => option.available)?.method ??
    null;

  if (!ready) {
    return (
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <Skeleton className="h-96 flex-1 rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl lg:w-[380px] lg:shrink-0" />
      </div>
    );
  }

  /** The API answers an address change with the whole list; the new address is the last one. */
  function handleAddAddress(list: AddressDTO[]) {
    setAddresses(list);
    setSelectedAddressId(list.at(-1)?.id ?? null);
    setShowAddAddress(false);
  }

  async function handlePlaceOrder() {
    if (submitting) return;
    setFormError(null);

    if (!selectedAddress) {
      setFormError('Choose a delivery address.');
      return;
    }
    if (!selectedAddress.areaServiceable) {
      setFormError(`We don't deliver to ${selectedAddress.areaName ?? 'this area'} yet.`);
      return;
    }
    if (pricedCart.deliveryFee === null) {
      setFormError('Choose a delivery address to see the delivery fee.');
      return;
    }
    if (!paymentMethod) {
      setFormError('Choose a payment method.');
      return;
    }
    if (customerNote.length > NOTE_MAX) {
      setFormError(`Use at most ${NOTE_MAX} characters for the order note.`);
      return;
    }

    setSubmitting(true);
    try {
      const note = customerNote.trim();
      const { data: order } = await apiClient<ApiResponse<CustomerOrderDTO>>('/orders', {
        method: 'POST',
        headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
        body: {
          addressId: selectedAddress.id,
          paymentMethod,
          expectedTotal: pricedCart.total,
          ...(note && { customerNote: note }),
        },
      });
      setPlaced(true);
      router.push(routes.checkoutSuccess(order.orderNumber));
      clear();
    } catch (error) {
      const freshCart = cartFromError(error);
      if (freshCart) queryClient.setQueryData(cartQueryKeys.customer(areaId), freshCart);
      setFormError(errorMessage(error, "We couldn't place your order. Please try again."));
      setSubmitting(false);
    }
  }

  const canPlaceOrder =
    Boolean(selectedAddress?.areaServiceable) && pricedCart.deliveryFee !== null && paymentMethod !== null;

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <div className="flex flex-1 flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h2 className="type-h2">1. Delivery address</h2>

          {addresses.length > 0 ? (
            <RadioGroup value={selectedAddressId ?? undefined} onValueChange={setSelectedAddressId} className="gap-3">
              {addresses.map((address) => (
                <label
                  key={address.id}
                  htmlFor={`address-${address.id}`}
                  className={cn(
                    CARD_CLASS,
                    'flex items-start gap-3 p-4',
                    address.areaServiceable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
                    selectedAddressId === address.id && address.areaServiceable && 'border-2 border-ink',
                  )}
                >
                  <RadioGroupItem
                    id={`address-${address.id}`}
                    value={address.id}
                    size="md"
                    disabled={!address.areaServiceable}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold text-ink">{address.label}</span>
                    <span className="text-sm text-ink-700">
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ''}
                    </span>
                    {address.landmark ? <span className="text-sm text-cement">{address.landmark}</span> : null}
                    <span className="text-sm text-cement">
                      {address.areaName ?? 'Unknown area'}, {address.city}
                    </span>
                    {!address.areaServiceable ? (
                      <span className="text-sm text-danger">
                        We don&apos;t deliver to {address.areaName ?? 'this area'} yet.
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </RadioGroup>
          ) : null}

          {showAddAddress ? (
            <AddAddressForm
              areas={areas}
              onAdd={handleAddAddress}
              onCancel={addresses.length > 0 ? () => setShowAddAddress(false) : undefined}
            />
          ) : (
            <Button type="button" variant="secondary" onClick={() => setShowAddAddress(true)} className="self-start">
              <Plus aria-hidden strokeWidth={1.75} className="size-4" />
              Add new address
            </Button>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="type-h2">2. Payment method</h2>
          <RadioGroup
            value={paymentMethod ?? undefined}
            onValueChange={(value) => setChosenMethod(value as PaymentMethod)}
            className="gap-3"
          >
            {options
              .filter((option) => option.enabled)
              .map((option) => (
                <PaymentMethodCard
                  key={option.method}
                  method={option.method}
                  title={PAYMENT_METHOD_LABELS[option.method]}
                  description={
                    option.method === 'COD'
                      ? 'Pay the rider when your order arrives.'
                      : 'Transfer and upload your receipt.'
                  }
                  reason={option.reason}
                  disabled={!option.available}
                  selected={paymentMethod === option.method}
                />
              ))}
          </RadioGroup>

          {paymentMethod === 'BANK_TRANSFER' ? (
            <div className="flex flex-col gap-2">
              <BankDetails accounts={settings.bankAccounts} instructions={settings.bankTransferInstructions} />
              <p className="text-sm text-ink-700">You can upload the receipt after placing the order.</p>
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="type-h2">3. Review your order</h2>
          <div className={cn(CARD_CLASS, 'flex items-center justify-between p-4')}>
            <span className="text-sm text-ink-700">
              {pricedCart.itemCount} item{pricedCart.itemCount === 1 ? '' : 's'} in your cart
            </span>
            <Link href={routes.cart} className="text-sm font-medium text-blueprint hover:text-blueprint-700 hover:underline">
              View cart
            </Link>
          </div>
          <FormField label="Note for your order" htmlFor="customer-note" hint="Optional — e.g. delivery instructions.">
            <Textarea
              id="customer-note"
              value={customerNote}
              onChange={(event) => setCustomerNote(event.target.value.slice(0, NOTE_MAX))}
              placeholder="E.g. call before arriving at the site gate"
            />
          </FormField>
        </section>
      </div>

      <div className="flex w-full flex-col gap-4 lg:w-[380px] lg:shrink-0">
        <OrderSummary pricedCart={pricedCart}>
          <FormError message={formError} />
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={!canPlaceOrder}
            loading={submitting}
            onClick={() => void handlePlaceOrder()}
          >
            Place order
          </Button>
        </OrderSummary>
      </div>
    </div>
  );
}
