import { formatPKR, PAYMENT_METHOD_LABELS, type BankAccountDTO, type CustomerOrderDTO } from '@aricon/shared';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { BankDetails } from './bank-details';
import { ReceiptUpload } from './receipt-upload';
import { CARD_CLASS, iconProps } from './styles';

export interface OrderSuccessViewProps {
  order: CustomerOrderDTO;
  whatsapp: string;
  bankAccounts: BankAccountDTO[];
  bankTransferInstructions: string;
}

/**
 * Order placed page (SPEC §8.8): order number, a short summary, payment-specific next steps
 * (bank details and receipt upload for bank transfer) and support links.
 */
export function OrderSuccessView({ order, whatsapp, bankAccounts, bankTransferInstructions }: OrderSuccessViewProps) {
  const whatsappHref = `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, my order ${order.orderNumber}`)}`;

  return (
    <div className="mx-auto flex max-w-160 flex-col items-center gap-6 px-4 py-10 text-center md:px-8 md:py-16">
      <CheckCircle2 {...iconProps} className="size-16 text-success" />
      <div className="flex flex-col gap-1">
        <h1 className="type-h1">Order placed</h1>
        <p className="font-display text-xl font-semibold tabular-nums text-ink-700">{order.orderNumber}</p>
      </div>

      <div className={cn(CARD_CLASS, 'flex w-full flex-col gap-3 p-5 text-left')}>
        <div className="flex justify-between text-sm">
          <span className="text-ink-700">Payment method</span>
          <span className="font-medium text-ink">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ink-700">Delivering to</span>
          <span className="font-medium text-ink">
            {order.shippingAddress.label} · {order.shippingAddress.areaName}
          </span>
        </div>
        <div className="flex justify-between border-t border-concrete-150 pt-3 text-sm">
          <span className="text-ink-700">Subtotal</span>
          <span className="text-ink tabular-nums">{formatPKR(order.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ink-700">Delivery</span>
          <span className="text-ink tabular-nums">{order.deliveryFee === 0 ? 'Free' : formatPKR(order.deliveryFee)}</span>
        </div>
        <div className="flex items-baseline justify-between border-t border-concrete-150 pt-3">
          <span className="type-h3">Total</span>
          <span className="type-price">{formatPKR(order.total)}</span>
        </div>
      </div>

      {order.paymentMethod === 'COD' ? (
        <p className="max-w-[48ch] text-ink-700">
          We&apos;ll confirm your order and call before delivery. Pay {formatPKR(order.total)} in cash when your order
          arrives.
        </p>
      ) : (
        <div className="flex w-full flex-col gap-4 text-left">
          <BankDetails accounts={bankAccounts} instructions={bankTransferInstructions} />
          {order.canUploadReceipt ? <ReceiptUpload orderNumber={order.orderNumber} /> : null}
        </div>
      )}

      <div className="flex w-full flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href={routes.accountOrder(order.orderNumber)}>View order</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href={routes.home}>Continue shopping</Link>
        </Button>
      </div>

      <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="link text-sm font-medium">
        Chat on WhatsApp about this order
      </a>
    </div>
  );
}
