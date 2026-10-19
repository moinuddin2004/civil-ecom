import { formatNumber } from '@aricon/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ActiveFilterChips, countActiveFilters } from '@/components/shop/active-filter-chips';
import { FilterPanel } from '@/components/shop/filter-panel';
import { Pagination } from '@/components/shop/pagination';
import { ProductCard } from '@/components/shop/product-card';
import { ProductGrid } from '@/components/shop/product-grid';
import { ListingEmptyState, ProductListingShell } from '@/components/shop/product-listing';
import { SortSelect } from '@/components/shop/sort-select';
import { Button } from '@/components/ui/button';
import { getProducts } from '@/lib/api-server';
import { parseProductSearchParams, type SearchParamsInput } from '@/lib/product-query';
import { routes } from '@/lib/routes';

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** SPEC §8.1: search is always dynamic and `noindex`. */
export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const rawSearchParams = await searchParams;
  const query = parseProductSearchParams(rawSearchParams as SearchParamsInput);
  return {
    title: query.q ? `Search results for "${query.q}"` : 'Search',
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const rawSearchParams = await searchParams;
  const query = parseProductSearchParams(rawSearchParams as SearchParamsInput);

  if (!query.q) {
    return (
      <div className="mx-auto flex max-w-content flex-col items-center gap-4 px-4 py-16 text-center md:px-8">
        <h1 className="type-h1">Search</h1>
        <p className="max-w-[48ch] text-ink-700">Search for cement, wires, pipes...</p>
        <Button asChild variant="secondary">
          <Link href={routes.home}>Browse categories</Link>
        </Button>
      </div>
    );
  }

  const { data, meta, facets } = await getProducts({ ...query, q: query.q });
  const basePath = routes.search();

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="type-h1">Results for &ldquo;{query.q}&rdquo;</h1>
        <p className="text-sm text-ink-700 tabular-nums">{formatNumber(meta.total)} products</p>
      </div>

      {data.length === 0 ? (
        <ListingEmptyState
          message={`No matches for "${query.q}". Try a brand or product type.`}
          actionLabel="Browse categories"
          actionHref={routes.home}
        />
      ) : (
        <ProductListingShell
          total={meta.total}
          activeFilterCount={countActiveFilters(query)}
          mobileFilterPanel={<FilterPanel query={query} facets={facets} basePath={basePath} idPrefix="mobile" />}
          desktopFilterPanel={<FilterPanel query={query} facets={facets} basePath={basePath} idPrefix="desktop" />}
          sortSelect={<SortSelect currentSort={query.sort} />}
          activeChips={<ActiveFilterChips query={query} facets={facets} basePath={basePath} />}
        >
          <ProductGrid aria-label={`Results for ${query.q}`}>
            {data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ProductGrid>
          <Pagination basePath={basePath} query={query} meta={meta} className="mt-2" />
        </ProductListingShell>
      )}
    </div>
  );
}
