'use client';

import {
  formatPKR,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type AdminCustomerDetailDTO,
  type AdminCustomerListItemDTO,
  type AdminOrderDTO,
  type AdminOrderProductOptionDTO,
  type ApiListResponse,
  type ApiResponse,
  type PaymentMethod,
  type PricedCart,
} from '@aricon/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, newIdempotencyKey } from '@/lib/api-client';
import { useAdminSession } from '@/lib/admin/session';
import { errorMessage, isApiError } from '@/lib/api-errors';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';

interface OrderLine {
  productId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  price: number;
  stock: number;
  qty: number;
}

const IDEMPOTENCY_HEADER_NAME = 'Idempotency-Key';

/**
 * Create an order for a customer (SPEC §6.6a): pick the customer and one of their saved addresses,
 * add products, choose the payment method. Prices, delivery and the total shown here come from
 * `POST /api/admin/orders/quote`; placing the order sends that total back so the API can reject it
 * if prices moved (409 PRICE_CHANGED). One idempotency key per form, so a double click can't create two orders.
 */
export function CreateOrderForm() {
  const router = useRouter();
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey());

  const [customerSearch, setCustomerSearch] = useState('');
  const [customer, setCustomer] = useState<AdminCustomerListItemDTO | null>(null);
  const [addressId, setAddressId] = useState('');

  const [productSearch, setProductSearch] = useState('');
  const [lines, setLines] = useState<OrderLine[]>([]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [note, setNote] = useState('');
  // Staff with `orders.discount` can take an amount off the subtotal; the API checks the permission again.
  const { me } = useAdminSession();
  const canDiscount = Boolean(me?.permissions.includes('orders.discount'));
  const [discountText, setDiscountText] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const discountAmount = canDiscount ? Math.max(0, Math.floor(Number(discountText) || 0)) : 0;
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const debouncedCustomerSearch = useDebouncedValue(customerSearch.trim());
  const debouncedProductSearch = useDebouncedValue(productSearch.trim());

  const customers = useQuery({
    queryKey: ['admin-order-customers', debouncedCustomerSearch],
    enabled: !customer && debouncedCustomerSearch.length >= 2,
    queryFn: () =>
      apiClient<ApiListResponse<AdminCustomerListItemDTO>>(
        `/admin/customers?q=${encodeURIComponent(debouncedCustomerSearch)}&status=active&pageSize=8`,
      ),
  });

  const customerDetail = useQuery({
    queryKey: ['admin-order-customer', customer?.id],
    enabled: Boolean(customer),
    queryFn: () => apiClient<ApiResponse<AdminCustomerDetailDTO>>(`/admin/customers/${customer?.id ?? ''}`),
  });
  const addresses = customerDetail.data?.data.addresses ?? [];
  // The default (or only) address is pre-selected until staff pick another one.
  const selectedAddressId = addressId || (addresses.find((address) => address.isDefault) ?? addresses[0])?.id || '';

  const options = useQuery({
    queryKey: ['admin-order-products', debouncedProductSearch],
    enabled: debouncedProductSearch.length >= 2,
    queryFn: () =>
      apiClient<ApiResponse<AdminOrderProductOptionDTO[]>>(
        `/admin/orders/product-options?q=${encodeURIComponent(debouncedProductSearch)}`,
      ),
  });

  const quoteItems = lines.map(({ productId, variantId, qty }) => ({ productId, variantId, qty }));
  const quoteKey = JSON.stringify([customer?.id, selectedAddressId, quoteItems, discountAmount]);
  const debouncedQuoteKey = useDebouncedValue(quoteKey, 250);
  const quote = useQuery({
    queryKey: ['admin-order-quote', debouncedQuoteKey],
    enabled: Boolean(customer) && selectedAddressId !== '' && lines.length > 0 && debouncedQuoteKey === quoteKey,
    retry: false,
    queryFn: () =>
      apiClient<ApiResponse<PricedCart & { discount: number }>>('/admin/orders/quote', {
        method: 'POST',
        body: { userId: customer?.id, addressId: selectedAddressId, items: quoteItems, discountAmount: discountAmount || undefined },
      }),
  });
  const cart = quote.data?.data;
  const quoteError = quote.error ? errorMessage(quote.error) : null;

  function chooseCustomer(next: AdminCustomerListItemDTO) {
    setCustomer(next);
    setAddressId('');
    setCustomerSearch('');
  }

  function clearCustomer() {
    setCustomer(null);
    setAddressId('');
  }

  function addProduct(option: AdminOrderProductOptionDTO) {
    setLines((current) => {
      const existing = current.find((line) => line.variantId === option.variantId);
      if (existing) return current.map((line) => (line.variantId === option.variantId ? { ...line, qty: line.qty + 1 } : line));
      return [...current, { ...option, qty: 1 }];
    });
    setProductSearch('');
  }

  function setQty(variantId: string, qty: number) {
    setLines((current) => current.map((line) => (line.variantId === variantId ? { ...line, qty } : line)));
  }

  function removeLine(variantId: string) {
    setLines((current) => current.filter((line) => line.variantId !== variantId));
  }

  const lineIssue = (variantId: string) => cart?.lines.find((line) => line.variantId === variantId)?.issue?.message;
  const quoteIsCurrent = debouncedQuoteKey === quoteKey && !quote.isFetching;
  const discountNeedsReason = discountAmount > 0 && discountReason.trim() === '';
  const canSubmit =
    Boolean(customer) && selectedAddressId !== '' && lines.length > 0 && Boolean(cart?.canCheckout) && quoteIsCurrent && !discountNeedsReason && !submitting;

  async function submit() {
    if (!customer || !cart) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const { data } = await apiClient<ApiResponse<AdminOrderDTO>>('/admin/orders', {
        method: 'POST',
        headers: { [IDEMPOTENCY_HEADER_NAME]: idempotencyKey },
        body: {
          userId: customer.id,
          addressId: selectedAddressId,
          items: quoteItems,
          paymentMethod,
          customerNote: note.trim() || undefined,
          discountAmount: discountAmount || undefined,
          discountReason: discountAmount > 0 ? discountReason.trim() : undefined,
          expectedTotal: cart.total,
        },
      });
      toast.success('Order created', { description: data.orderNumber });
      router.push(`/admin/orders/${data.id}`);
    } catch (error) {
      if (isApiError(error) && (error.code === 'PRICE_CHANGED' || error.code === 'OUT_OF_STOCK')) {
        // The cart in the form is out of date: price it again and let staff review before retrying.
        setIdempotencyKey(newIdempotencyKey());
        void quote.refetch();
      }
      setFormError(errorMessage(error, "We couldn't create this order. Please try again."));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="type-h1">Create order</h1>
        <p className="text-sm text-cement">Prices, delivery fee and stock are worked out by the system, the same as when a customer orders.</p>
      </div>

      <section className="flex flex-col gap-4 rounded-xl border border-concrete-150 bg-surface p-5 shadow-card">
        <h2 className="type-h3">Customer</h2>
        {customer ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-concrete-50 p-3">
            <div className="flex flex-col text-sm">
              <span className="font-semibold text-ink">{customer.name}</span>
              <span className="text-ink-700">
                {customer.phone} · {customer.email}
              </span>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={clearCustomer}>
              Change customer
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <FormField label="Find customer" htmlFor="order-customer-search" hint="Search by name, phone or email (at least 2 characters).">
              <Input
                id="order-customer-search"
                size="sm"
                autoComplete="off"
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
              />
            </FormField>
            {customers.isFetching ? <p className="text-sm text-cement">Searching…</p> : null}
            {customers.data && customers.data.data.length === 0 ? (
              <p className="text-sm text-cement">No customers found. A new customer has to sign up (or be added) before you can create an order for them.</p>
            ) : null}
            <ul className="flex flex-col divide-y divide-concrete-150 rounded-lg border border-concrete-150">
              {(customers.data?.data ?? []).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => chooseCustomer(item)}
                    className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-concrete-50"
                  >
                    <span className="font-medium text-ink">{item.name}</span>
                    <span className="text-ink-700">
                      {item.phone} · {item.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {customer ? (
          <div className="flex flex-col gap-1.5">
            <FormField label="Delivery address" htmlFor="order-address" required>
              {customerDetail.isLoading ? (
                <p className="text-sm text-cement">Loading addresses…</p>
              ) : addresses.length === 0 ? (
                <p className="text-sm text-danger">This customer has no saved address. They need to add one in their account first.</p>
              ) : (
                <Select
                  id="order-address"
                  size="sm"
                  placeholder="Select address"
                  value={selectedAddressId}
                  onValueChange={setAddressId}
                  options={addresses.map((address) => ({
                    value: address.id,
                    label: `${address.label} · ${address.line1}, ${address.areaName ?? address.city}`,
                  }))}
                />
              )}
            </FormField>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-concrete-150 bg-surface p-5 shadow-card">
        <h2 className="type-h3">Products</h2>
        <FormField label="Add product" htmlFor="order-product-search" hint="Search by product name or SKU (at least 2 characters).">
          <Input
            id="order-product-search"
            size="sm"
            autoComplete="off"
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
          />
        </FormField>
        {options.isFetching ? <p className="text-sm text-cement">Searching…</p> : null}
        {options.data && options.data.data.length === 0 ? <p className="text-sm text-cement">No matching products.</p> : null}
        {options.data && options.data.data.length > 0 ? (
          <ul className="flex flex-col divide-y divide-concrete-150 rounded-lg border border-concrete-150">
            {options.data.data.map((option) => (
              <li key={option.variantId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-ink">
                    {option.productName} · {option.variantLabel}
                  </span>
                  <span className="text-ink-700">
                    {option.sku} · {formatPKR(option.price)} · {option.stock} in stock
                  </span>
                </div>
                <Button type="button" variant="secondary" size="sm" disabled={option.stock <= 0} onClick={() => addProduct(option)}>
                  {option.stock <= 0 ? 'Out of stock' : 'Add to order'}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {lines.length === 0 ? (
          <p className="text-sm text-cement">No products added yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-concrete-150 rounded-lg border border-concrete-150">
            {lines.map((line) => {
              const priced = cart?.lines.find((item) => item.variantId === line.variantId);
              const issue = lineIssue(line.variantId);
              return (
                <li key={line.variantId} className="flex flex-wrap items-center gap-3 px-3 py-3 text-sm">
                  <div className="flex min-w-48 flex-1 flex-col">
                    <span className="font-medium text-ink">
                      {line.productName} · {line.variantLabel}
                    </span>
                    <span className="text-ink-700">
                      {priced ? `${formatPKR(priced.unitPrice)} each` : `${formatPKR(line.price)} each`}
                    </span>
                    {issue ? <span className="text-danger">{issue}</span> : null}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`qty-${line.variantId}`} className="sr-only">
                      Quantity of {line.productName}
                    </label>
                    <Input
                      id={`qty-${line.variantId}`}
                      size="sm"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      className="w-24"
                      value={line.qty}
                      onChange={(event) => setQty(line.variantId, Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                    />
                  </div>
                  <span className="w-28 text-right font-semibold tabular-nums">{priced ? formatPKR(priced.lineTotal) : '—'}</span>
                  <Button type="button" variant="secondary" size="sm" onClick={() => removeLine(line.variantId)}>
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-concrete-150 bg-surface p-5 shadow-card">
        <h2 className="type-h3">Payment and note</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Payment method" htmlFor="order-payment" required>
            <Select
              id="order-payment"
              size="sm"
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
              options={PAYMENT_METHODS.map((method) => ({ value: method, label: PAYMENT_METHOD_LABELS[method] }))}
            />
          </FormField>
        </div>
        {canDiscount ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Discount (Rs)" htmlFor="order-discount" hint="Taken off the products total, not the delivery fee.">
              <Input
                id="order-discount"
                size="sm"
                type="number"
                inputMode="numeric"
                min={0}
                value={discountText}
                onChange={(event) => setDiscountText(event.target.value)}
              />
            </FormField>
            <FormField
              label="Discount reason"
              htmlFor="order-discount-reason"
              required={discountAmount > 0}
              error={discountNeedsReason ? 'Add a reason for the discount.' : undefined}
            >
              <Input
                id="order-discount-reason"
                size="sm"
                maxLength={300}
                value={discountReason}
                onChange={(event) => setDiscountReason(event.target.value)}
              />
            </FormField>
          </div>
        ) : null}
        <FormField label="Order note" htmlFor="order-note" hint="Optional. Shown on the order, for example delivery instructions.">
          <Textarea id="order-note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
        </FormField>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-concrete-150 bg-surface p-5 shadow-card">
        <h2 className="type-h3">Summary</h2>
        {quoteError ? <FormError message={quoteError} /> : null}
        {cart ? (
          <dl className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-700">Subtotal</dt>
              <dd className="tabular-nums">{formatPKR(cart.subtotal)}</dd>
            </div>
            {cart.discount > 0 ? (
              <div className="flex justify-between text-success">
                <dt>Discount</dt>
                <dd className="tabular-nums">-{formatPKR(cart.discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-ink-700">Delivery{cart.area ? ` (${cart.area.name})` : ''}</dt>
              <dd className="tabular-nums">{cart.deliveryFee === null ? '—' : cart.deliveryFee === 0 ? 'Free' : formatPKR(cart.deliveryFee)}</dd>
            </div>
            <div className="flex justify-between border-t border-concrete-150 pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPKR(cart.total)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-cement">Choose a customer, an address and at least one product to see the total.</p>
        )}
        {cart && !cart.canCheckout && !quoteError ? (
          <p className="text-sm text-danger">This order can&apos;t be placed yet. Fix the items marked above or choose a delivery address in an area we deliver to.</p>
        ) : null}
        <FormError message={formError} />
        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={() => router.push('/admin/orders')}>
            Cancel
          </Button>
          <Button type="button" loading={submitting} disabled={!canSubmit} onClick={() => void submit()}>
            Create order
          </Button>
        </div>
      </section>
    </div>
  );
}
