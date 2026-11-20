import { formatNumber, type CategoryTileDTO } from '@aricon/shared';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { staticImageSrc } from '@/lib/images';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { CategoryGlyph } from './category-glyph';
import { toListItems } from './list-items';
import { CARD_CLASS } from './styles';

export function productCountLabel(count: number): string {
  return `${formatNumber(count)} ${count === 1 ? 'product' : 'products'}`;
}

const photographedDepartments = new Set(['cement-plaster', 'tiles-adhesives', 'paint', 'electrical', 'plumbing', 'hardware']);

export interface CategoryTileProps {
  category: Pick<CategoryTileDTO, 'name' | 'slug' | 'productCount'> & Partial<Pick<CategoryTileDTO, 'imageKey'>>;
  /** Defaults to the category page. */
  href?: string;
  className?: string;
}

/**
 * "Shop by category" tile (v2 §2.3): icon well, name and product count; lifts on hover. Uses the
 * category photo when available and the technical icon as a fallback.
 */
export function CategoryTile({ category, href, className }: CategoryTileProps) {
  const photo = category.imageKey
    ? staticImageSrc(category.imageKey)
    : photographedDepartments.has(category.slug) ? `/images/categories/${category.slug}.webp` : null;
  return (
    <Link
      href={href ?? routes.category(category.slug)}
      className={cn(
        CARD_CLASS,
        'flex h-full min-h-[148px] w-full flex-col items-start gap-3 p-4 text-left',
        'transition-[transform,box-shadow,border-color] duration-150 ease-out',
        'hover:-translate-y-[3px] hover:border-concrete-400 hover:shadow-card-hover',
        className,
      )}
    >
      <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-concrete-100 text-ink">
        {photo ? (
          <Image src={photo} width={64} height={64} alt="" className="size-full object-cover" />
        ) : (
          <CategoryGlyph hint={category.slug} size={48} className="lg:size-14" />
        )}
      </span>
      <span className="flex flex-col">
        <span className="text-base/[22px] font-semibold">{category.name}</span>
        <span className="text-[13px]/[18px] text-cement tabular-nums">
          {productCountLabel(category.productCount)}
        </span>
      </span>
    </Link>
  );
}

/** Tiles grid: 2 columns (M), 3 (tablet), 6 (D). */
export function CategoryTileGrid({
  children,
  'aria-label': ariaLabel,
  className,
}: {
  children: ReactNode;
  'aria-label'?: string;
  className?: string;
}) {
  return (
    <ul
      aria-label={ariaLabel}
      className={cn('grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 lg:gap-6', className)}
    >
      {toListItems(children, 'flex min-w-0')}
    </ul>
  );
}
