'use client';

import {
  formatPKR,
  getUnitPrice,
  lineTotal,
  type ProductDetail,
  type ProductVariantDTO,
} from '@aricon/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api-errors';
import { useCart } from '@/lib/cart/cart-context';
import { routes } from '@/lib/routes';
import { PriceBlock } from './price-block';
import { ProductQuantity } from './product-quantity';
import { stockLevel, StockBadge } from './status-badges';
import { VariantChips } from './variant-chips';

export interface ProductPurchasePanelProps {
  product: ProductDetail;
  /** Store WhatsApp number (E.164), for the out-of-stock "ask us" link. */
  whatsapp: string;
  className?: string;
}

/** First variant with stock, or the first variant when none has stock (SPEC §8.4 default logic). */
function initialVariant(product: ProductDetail): ProductVariantDTO {
  return product.variants.find((variant) => variant.stock > 0) ?? product.variants[0]!;
}

/**
 * The interactive half of the product page (SPEC §8.5, DESIGN.md §6.3): owns the selected variant
 * and quantity, and wires the price block, quantity stepper and "Add to cart" together. Rendered
 * once and laid out by the page — mobile stacks it under the gallery, desktop pins it in the right
 * column (`className="lg:sticky lg:top-24"` from the caller).
 */
export function ProductPurchasePanel({ product, whatsapp, className }: ProductPurchasePanelProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const [variant, setVariant] = useState<ProductVariantDTO>(() => initialVariant(product));
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  function selectVariant(next: ProductVariantDTO) {
    if (next.id === variant.id) return;
    setVariant(next);
    // A different variant has its own stock and tiers; start over rather than carry over a quantity
    // that might exceed it or land on a tier that no longer makes sense.
    setQty(1);
  }

  const { unitPrice } = getUnitPrice(variant, qty);
  const level = stockLevel(variant.stock, variant.lowStockThreshold);
  const whatsappHref = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Hi, when will ${product.brand.name} ${product.name} be back in stock?`,
      )}`
    : null;

  async function handleAdd() {
    setAdding(true);
    try {
      await addItem({ productId: product.id, variantId: variant.id, qty });
      toast.success('Added to cart', {
        action: { label: 'View cart', onClick: () => router.push(routes.cart) },
      });
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't add this to your cart. Please try again."));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Link
            href={routes.brand(product.brand.slug)}
            className="w-fit text-sm font-medium text-cement hover:text-ink"
          >
            {product.brand.name}
          </Link>
          <h1 className="type-h1">{product.name}</h1>
          <StockBadge level={level} appearance="dot" />
        </div>

        {product.optionKeys.length > 0 ? (
          <VariantChips
            optionKeys={product.optionKeys}
            variants={product.variants}
            selected={variant}
            onSelect={selectVariant}
          />
        ) : null}

        <PriceBlock
          unit={product.unit}
          mrp={variant.mrp}
          price={variant.price}
          bulkTiers={variant.bulkTiers}
          qty={qty}
          onQtyChange={setQty}
          maxQty={variant.stock}
          disabled={variant.stock <= 0}
        />

        <ProductQuantity
          unit={product.unit}
          qty={qty}
          onQtyChange={setQty}
          stock={variant.stock}
          unitPrice={unitPrice}
          onAdd={handleAdd}
          adding={adding}
          whatsappHref={whatsappHref}
        />

        <p className="text-sm text-ink-700">
          Delivery fee shown at checkout. Cash on delivery and bank transfer accepted.
        </p>
      </div>

      {/* Mobile sticky bar (SPEC §8.5, §15): hidden once out of stock — the block above already
          shows "Out of stock" and the WhatsApp link inline, so there is nothing to add. */}
      {variant.stock > 0 ? (
        <div
          data-mobile-sticky-bar
          className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 border-t border-concrete-200 bg-surface px-4 py-3 shadow-float-up lg:hidden"
        >
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs text-cement">
              {qty} × {formatPKR(unitPrice)}
            </span>
            <span className="font-display text-xl font-bold tabular-nums">
              {formatPKR(lineTotal(unitPrice, qty))}
            </span>
          </div>
          <Button size="lg" className="shrink-0" loading={adding} onClick={handleAdd}>
            Add to cart
          </Button>
        </div>
      ) : null}
    </div>
  );
}
