import { FILTER_KEYS, formatPKR, type ProductFacets, type ProductListQuery } from '@aricon/shared';
import { X } from 'lucide-react';
import Link from 'next/link';
import { buildListingHref, withFilterValues, withoutPage } from '@/lib/product-query';
import { cn } from '@/lib/utils';

interface Chip {
  key: string;
  label: string;
  href: string;
}

function buildChips(query: ProductListQuery, facets: ProductFacets, basePath: string): Chip[] {
  const chips: Chip[] = [];

  for (const slug of query.brand ?? []) {
    const name = facets.brands.find((brand) => brand.slug === slug)?.name ?? slug;
    const nextBrand = (query.brand ?? []).filter((item) => item !== slug);
    chips.push({
      key: `brand-${slug}`,
      label: name,
      href: buildListingHref(basePath, withoutPage({ ...query, brand: nextBrand })),
    });
  }

  for (const key of FILTER_KEYS) {
    for (const value of query[key] ?? []) {
      const nextValues = (query[key] ?? []).filter((item) => item !== value);
      const nextQuery = withoutPage(withFilterValues(query, key, nextValues));
      chips.push({ key: `${key}-${value}`, label: value, href: buildListingHref(basePath, nextQuery) });
    }
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    let label = '';
    if (query.minPrice !== undefined && query.maxPrice !== undefined) {
      label = `${formatPKR(query.minPrice)} - ${formatPKR(query.maxPrice)}`;
    } else if (query.minPrice !== undefined) {
      label = `Over ${formatPKR(query.minPrice)}`;
    } else if (query.maxPrice !== undefined) {
      label = `Under ${formatPKR(query.maxPrice)}`;
    }
    chips.push({
      key: 'price',
      label,
      href: buildListingHref(basePath, withoutPage({ ...query, minPrice: undefined, maxPrice: undefined })),
    });
  }

  if (query.inStock) {
    chips.push({
      key: 'inStock',
      label: 'In stock only',
      href: buildListingHref(basePath, withoutPage({ ...query, inStock: undefined })),
    });
  }

  return chips;
}

/** Number of active filters (brand + facet values + price range + in-stock), for "Filters (n)". */
export function countActiveFilters(query: ProductListQuery): number {
  let count = query.brand?.length ?? 0;
  for (const key of FILTER_KEYS) count += query[key]?.length ?? 0;
  if (query.minPrice !== undefined || query.maxPrice !== undefined) count += 1;
  if (query.inStock) count += 1;
  return count;
}

export interface ActiveFilterChipsProps {
  query: ProductListQuery;
  facets: ProductFacets;
  basePath: string;
  className?: string;
}

/** Removable pill per active filter (DESIGN.md §6 "Filter panel": "Active filters as removable chips"). */
export function ActiveFilterChips({ query, facets, basePath, className }: ActiveFilterChipsProps) {
  const chips = buildChips(query, facets, basePath);
  if (chips.length === 0) return null;

  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link
            href={chip.href}
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-concrete-200 bg-surface py-1 pr-2 pl-3 text-sm font-medium text-ink hover:border-concrete-400"
          >
            {chip.label}
            <X aria-hidden strokeWidth={1.75} className="size-4 text-cement" />
            <span className="sr-only">Remove filter</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
