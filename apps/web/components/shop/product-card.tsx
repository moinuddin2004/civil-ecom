import { discountPercent, formatPKR, type ProductCard as ProductCardData } from '@aricon/shared';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { Price } from './price';
import { ProductImage } from './product-image';
import { cardStockLevel, StockBadge } from './status-badges';
import { StepsIcon } from './steps-icon';
import { iconProps } from './styles';

/** Listing grid: 2 columns (M), 3 (tablet), 4 (D) of about 240 px. */
export const PRODUCT_CARD_IMAGE_SIZES = '(min-width: 1024px) 260px, (min-width: 768px) 30vw, 45vw';

/** Card action buttons: h 44, radius 12 (v2 §1.12 2g). */
const ACTION_CLASS = 'h-11 w-full rounded-lg px-3 text-base/5';

/** Flat "7% off" tag on the image (HomeRun-style): small amber label, no pill. */
const OFF_TAG_CLASS = 'absolute top-0 left-0 rounded-br-lg rounded-tl-xl bg-amber px-2 py-1 text-xs/4 font-semibold text-ink tabular-nums';

export interface ProductCardProps {
  product: ProductCardData;
  /**
   * Adds the default variant, qty 1 (SPEC §8.4). Without it the "Add to cart" button links to the
   * product page, so the card also renders in Server Components.
   */
  onAdd?: (product: ProductCardData) => void;
  /** Shows the spinner on "Add to cart" while the add is in flight. */
  adding?: boolean;
  /** Category slug or name for the placeholder icon (the card DTO has no category). */
  categoryHint?: string;
  /** next/image `sizes`; the default fits the listing grid. */
  imageSizes?: string;
  className?: string;
}

/**
 * Product card (v2 §1.12, SPEC §8.4). States: one variant ("Add to cart"), several variants
 * ("From Rs …" + "Choose options"), low stock ("Only 4 left"), out of stock (image at 60%, badge,
 * disabled button). Lifts 3 px on hover.
 */
export function ProductCard({
  product,
  onAdd,
  adding = false,
  categoryHint,
  imageSizes = PRODUCT_CARD_IMAGE_SIZES,
  className,
}: ProductCardProps) {
  const href = routes.product(product.slug);
  const fullName = [product.brandName, product.name].filter(Boolean).join(' ');
  const stock = cardStockLevel(product);
  const outOfStock = stock.kind === 'out';
  const hasOptions = product.variantCount > 1;
  const pricesDiffer = hasOptions && product.minPrice !== product.maxPrice;
  const savePercent = discountPercent(product.mrpOfMin, product.minPrice);

  let action: ReactNode;
  if (outOfStock) {
    action = (
      <Button disabled className={ACTION_CLASS}>
        Out of stock
      </Button>
    );
  } else if (hasOptions) {
    action = (
      <Button asChild variant="secondary" className={ACTION_CLASS}>
        <Link href={href} aria-label={`Choose options: ${fullName}`}>
          Choose options
        </Link>
      </Button>
    );
  } else {
    const label = (
      <>
        {adding ? null : <ShoppingCart {...iconProps} />}
        <span className="lg:hidden">Add</span>
        <span className="hidden lg:inline">Add to cart</span>
      </>
    );
    const addClass = ACTION_CLASS;
    action = onAdd ? (
      <Button
        className={addClass}
        loading={adding}
        aria-label={`Add to cart: ${fullName}`}
        onClick={() => onAdd(product)}
      >
        {label}
      </Button>
    ) : (
      <Button asChild className={addClass}>
        <Link href={href} aria-label={`Add to cart: ${fullName}`}>
          {label}
        </Link>
      </Button>
    );
  }

  return (
    <article className={cn('group flex h-full w-full min-w-0 flex-col bg-surface', className)}>
      <div className="relative aspect-square">
        {/* The name below is the accessible link; this one is for pointer users only. */}
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className={cn(
            'relative flex size-full items-center justify-center overflow-hidden rounded-xl bg-concrete-50',
            'transition-colors duration-150 group-hover:bg-concrete-100',
            outOfStock && 'opacity-60',
          )}
        >
          <ProductImage
            imageKey={product.imageKey}
            alt={fullName}
            sizes={imageSizes}
            placeholderHint={categoryHint ?? product.name}
            placeholderSize={64}
            placeholderClassName="lg:size-[88px]"
          />
        </Link>
        {savePercent > 0 ? <span className={OFF_TAG_CLASS}>{savePercent}% off</span> : null}
        <StockBadge level={stock} appearance="overlay" className="absolute top-2 right-2" />
      </div>

      <div className="flex flex-1 flex-col gap-1 pt-3">
        <p className="text-sm text-cement">{product.brandName}</p>
        {/* Clamp the link, not the heading: an ancestor's overflow would clip the focus ring. */}
        <h3 className="min-h-11 text-base/[22px] text-pretty text-ink">
          <Link href={href} className="line-clamp-2">
            {product.name}
          </Link>
        </h3>
        <Price
          amount={product.minPrice}
          unit={product.unit}
          prefix={pricesDiffer ? 'From' : undefined}
          className="mt-0.5"
        />
        {savePercent > 0 ? (
          <p>
            <s className="text-sm text-cement tabular-nums">
              <span className="sr-only">MRP </span>
              {formatPKR(product.mrpOfMin)}
            </s>
          </p>
        ) : null}
        {product.lowestTierPrice !== null ? (
          <p className="flex items-center gap-1.5 text-sm text-blueprint">
            <StepsIcon size={16} />
            <span className="tabular-nums">Bulk from {formatPKR(product.lowestTierPrice)}</span>
          </p>
        ) : null}
        <div className="min-h-2 flex-1" />
        {action}
      </div>
    </article>
  );
}
