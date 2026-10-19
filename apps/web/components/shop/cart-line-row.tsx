'use client';

import { formatPKR, type PricedCartLine } from '@aricon/shared';
import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/lib/cart/cart-context';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { CompactTierNote } from './compact-tier-note';
import { Price } from './price';
import { ProductImage } from './product-image';
import { QuantityStepper } from './quantity-stepper';
import { iconProps } from './styles';

export interface CartLineRowProps {
  line: PricedCartLine;
}

/**
 * One cart line (DESIGN.md §6 "Cart line", SPEC §8.6): image, name, variant, unit price with the
 * bulk-price note, stepper, line total and remove; an unavailable/out-of-stock line shows only its
 * issue banner with a fix action instead of a price ("Only 6 in stock. Set to 6.").
 */
export function CartLineRow({ line }: CartLineRowProps) {
  const { setQty, removeItem } = useCart();
  const issue = line.issue;
  const blocked = issue?.code === 'OUT_OF_STOCK' || issue?.code === 'PRODUCT_UNAVAILABLE';
  const maxQty = issue?.code === 'QTY_EXCEEDS_STOCK' ? issue.maxQty : undefined;

  return (
    <div className="flex gap-3 p-4">
      <Link
        href={line.slug ? routes.product(line.slug) : '#'}
        aria-hidden={!line.slug}
        className={cn(
          'relative size-20 shrink-0 overflow-hidden rounded-md bg-concrete-50',
          !line.slug && 'pointer-events-none',
        )}
      >
        <div className="flex size-full items-center justify-center">
          <ProductImage
            imageKey={line.imageKey}
            alt={line.productName}
            sizes="80px"
            placeholderHint={line.productName}
            placeholderSize={32}
          />
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {line.slug ? (
              <Link href={routes.product(line.slug)} className="line-clamp-2 font-medium text-ink hover:text-blueprint">
                {line.productName}
              </Link>
            ) : (
              <p className="line-clamp-2 font-medium text-ink">{line.productName}</p>
            )}
            {line.variantLabel ? <p className="text-sm text-cement">{line.variantLabel}</p> : null}
          </div>
          <button
            type="button"
            aria-label={`Remove ${line.productName} from cart`}
            onClick={() => removeItem(line.variantId)}
            className="flex size-11 shrink-0 items-center justify-center text-cement hover:text-danger"
          >
            <Trash2 {...iconProps} className="size-5" />
          </button>
        </div>

        {!blocked ? <Price amount={line.unitPrice} unit={line.unit} size="sm" /> : null}
        {!blocked ? (
          <CompactTierNote
            appliedTierMinQty={line.appliedTierMinQty}
            nextTier={line.nextTier}
            onQtyChange={(qty) => setQty(line.variantId, qty)}
          />
        ) : null}

        {issue ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-danger-50 px-3 py-2 text-sm text-danger">
            <span>{issue.message}</span>
            {maxQty !== undefined ? (
              <button
                type="button"
                onClick={() => setQty(line.variantId, maxQty)}
                className="font-semibold underline underline-offset-2 hover:no-underline"
              >
                Set to {maxQty}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => removeItem(line.variantId)}
                className="font-semibold underline underline-offset-2 hover:no-underline"
              >
                Remove
              </button>
            )}
          </div>
        ) : null}

        {!blocked ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <QuantityStepper value={line.qty} onChange={(qty) => setQty(line.variantId, qty)} capAtMax={false} size="md" />
            <span className="font-display text-lg font-bold tabular-nums">{formatPKR(line.lineTotal)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
