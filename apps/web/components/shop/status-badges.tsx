import {
  formatNumber,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  RECEIPT_STATUS_LABELS,
  type OrderStatus,
  type PaymentStatus,
  type ProductCard,
  type ReceiptStatus,
} from '@aricon/shared';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * Pill badges (v2 §1.16, DESIGN.md §6.1). Colours are fixed per status so a status looks the same on
 * every screen. Where v2 lists no border, the border is transparent (it keeps every pill the same
 * height).
 */

const TONES = {
  info: 'border-transparent bg-blueprint-50 text-blueprint',
  outline: 'border-ink bg-surface text-ink',
  warning: 'border-transparent bg-amber-100 text-ink',
  success: 'border-transparent bg-success-50 text-success',
  danger: 'border-transparent bg-danger-50 text-danger',
  neutral: 'border-concrete-200 bg-concrete-50 text-ink-700',
  neutralFlat: 'border-transparent bg-concrete-50 text-ink-700',
  muted: 'border-cement bg-surface text-ink-700',
} as const;

export type BadgeTone = keyof typeof TONES;

const SIZES = {
  /** Order detail, receipts, DS default: px 7, py 3. */
  md: 'px-[7px] py-[3px]',
  /** List rows and the "Default" address badge: px 6, py 2. */
  sm: 'px-1.5 py-0.5',
} as const;

export type BadgeSize = keyof typeof SIZES;

export interface PillProps {
  tone: BadgeTone;
  size?: BadgeSize;
  className?: string;
  children: ReactNode;
}

export function Pill({ tone, size = 'md', className, children }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border text-xs font-medium whitespace-nowrap',
        SIZES[size],
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const ORDER_STATUS_TONES: Record<OrderStatus, BadgeTone> = {
  NEW: 'info',
  CONFIRMED: 'outline',
  DISPATCHED: 'warning',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  RETURNED: 'danger',
};

const PAYMENT_STATUS_TONES: Record<PaymentStatus, BadgeTone> = {
  PENDING: 'neutral',
  AWAITING_VERIFICATION: 'warning',
  PAID: 'success',
  REJECTED: 'danger',
  REFUNDED: 'muted',
};

const RECEIPT_STATUS_TONES: Record<ReceiptStatus, BadgeTone> = {
  pending: 'neutralFlat',
  approved: 'success',
  rejected: 'danger',
};

interface StatusBadgeProps<S> {
  status: S;
  size?: BadgeSize;
  className?: string;
}

/** "New", "Confirmed", "On the way", "Delivered", "Cancelled", "Returned". */
export function OrderStatusBadge({ status, size, className }: StatusBadgeProps<OrderStatus>) {
  return (
    <Pill tone={ORDER_STATUS_TONES[status]} size={size} className={className}>
      {ORDER_STATUS_LABELS[status]}
    </Pill>
  );
}

/** "Pending", "Awaiting verification", "Paid", "Rejected", "Refunded". */
export function PaymentStatusBadge({ status, size, className }: StatusBadgeProps<PaymentStatus>) {
  return (
    <Pill tone={PAYMENT_STATUS_TONES[status]} size={size} className={className}>
      {PAYMENT_STATUS_LABELS[status]}
    </Pill>
  );
}

/** Receipt review state: "Pending", "Approved", "Rejected" (no border). */
export function ReceiptStatusBadge({ status, size, className }: StatusBadgeProps<ReceiptStatus>) {
  return (
    <Pill tone={RECEIPT_STATUS_TONES[status]} size={size} className={className}>
      {RECEIPT_STATUS_LABELS[status]}
    </Pill>
  );
}

/** "Save 3%" on product cards. */
export function DiscountBadge({ percent, className }: { percent: number; className?: string }) {
  return (
    <Pill tone="success" size="sm" className={cn('tabular-nums', className)}>
      Save {percent}%
    </Pill>
  );
}

/** "Default" on the customer's default address. */
export function DefaultBadge({ className }: { className?: string }) {
  return (
    <Pill tone="info" size="sm" className={className}>
      Default
    </Pill>
  );
}

/* Stock */

export type StockLevel =
  | { kind: 'in_stock' }
  | { kind: 'low'; count: number }
  | { kind: 'out' };

/** SPEC §6.10: low stock is `stock ≤ lowStockThreshold` (and above 0). */
export function stockLevel(stock: number, lowStockThreshold: number): StockLevel {
  if (stock <= 0) return { kind: 'out' };
  if (stock <= lowStockThreshold) return { kind: 'low', count: stock };
  return { kind: 'in_stock' };
}

/** The level a product card shows: the DTO already applies the threshold (`lowStockCount`). */
export function cardStockLevel(product: Pick<ProductCard, 'inStock' | 'lowStockCount'>): StockLevel {
  if (!product.inStock) return { kind: 'out' };
  if (product.lowStockCount !== null && product.lowStockCount > 0) {
    return { kind: 'low', count: product.lowStockCount };
  }
  return { kind: 'in_stock' };
}

export function stockLabel(level: StockLevel): string {
  switch (level.kind) {
    case 'in_stock':
      return 'In stock';
    case 'low':
      return `Only ${formatNumber(level.count)} left`;
    case 'out':
      return 'Out of stock';
  }
}

const STOCK_TONES: Record<StockLevel['kind'], string> = {
  in_stock: 'bg-success-50 text-success',
  low: 'bg-amber-100 text-ink',
  out: 'bg-danger-50 text-danger',
};

export interface StockBadgeProps {
  level: StockLevel;
  /**
   * `dot`: the product page badge with a coloured dot, 13/18 (v2 §1.16).
   * `overlay`: the small pill on a product card image; renders nothing when simply in stock.
   */
  appearance?: 'dot' | 'overlay';
  className?: string;
}

export function StockBadge({ level, appearance = 'dot', className }: StockBadgeProps) {
  if (appearance === 'overlay') {
    if (level.kind === 'in_stock') return null;
    return (
      <span
        className={cn(
          'rounded-full px-1.5 py-[3px] text-xs font-medium whitespace-nowrap tabular-nums',
          STOCK_TONES[level.kind],
          className,
        )}
      >
        {stockLabel(level)}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 self-start rounded-full px-2 py-[3px] text-[13px]/[18px] font-medium whitespace-nowrap tabular-nums',
        STOCK_TONES[level.kind],
        className,
      )}
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-current" />
      {stockLabel(level)}
    </span>
  );
}
