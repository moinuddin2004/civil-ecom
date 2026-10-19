import { formatNumber } from '@aricon/shared';
import type { Metadata } from 'next';
import { ActiveFilterChips, countActiveFilters } from '@/components/shop/active-filter-chips';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';
import { FilterPanel } from '@/components/shop/filter-panel';
import { Pagination } from '@/components/shop/pagination';
import { ProductCard } from '@/components/shop/product-card';
import { ProductGrid } from '@/components/shop/product-grid';
import { ListingEmptyState, ProductListingShell } from '@/components/shop/product-listing';
import { SortSelect } from '@/components/shop/sort-select';
import { getBrand, getProducts, orNotFound } from '@/lib/api-server';
import { parseProductSearchParams, type SearchParamsInput } from '@/lib/product-query';
import { routes } from '@/lib/routes';

interface BrandPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = await orNotFound(getBrand(slug));
  return {
    title: brand.name,
    description: `Shop ${brand.name} products at bulk prices, delivered across Karachi.`,
    alternates: { canonical: routes.brand(slug) },
  };
}

export default async function BrandPage({ params, searchParams }: BrandPageProps) {
  const { slug } = await params;
  const rawSearchParams = await searchParams;
  const query = parseProductSearchParams(rawSearchParams as SearchParamsInput);
  // The brand is fixed by the path; ignore a stray `?brand=` so chips/pagination links stay consistent.
  query.brand = undefined;

  const [brand, { data, meta, facets }] = await Promise.all([
    orNotFound(getBrand(slug)),
    getProducts({ ...query, brand: [slug] }),
  ]);

  const basePath = routes.brand(slug);

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-6 md:px-8 md:py-10">
      <Breadcrumbs items={[]} current={brand.name} />

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="type-h1">{brand.name}</h1>
        <p className="text-sm text-ink-700 tabular-nums">{formatNumber(meta.total)} products</p>
      </div>

      <ProductListingShell
        total={meta.total}
        activeFilterCount={countActiveFilters(query)}
        mobileFilterPanel={
          <FilterPanel query={query} facets={facets} basePath={basePath} idPrefix="mobile" hideBrand />
        }
        desktopFilterPanel={
          <FilterPanel query={query} facets={facets} basePath={basePath} idPrefix="desktop" hideBrand />
        }
        sortSelect={<SortSelect currentSort={query.sort} />}
        activeChips={<ActiveFilterChips query={query} facets={facets} basePath={basePath} />}
      >
        {data.length > 0 ? (
          <>
            <ProductGrid aria-label={brand.name}>
              {data.map((product) => (
                <ProductCard key={product.id} product={product} categoryHint={brand.name} />
              ))}
            </ProductGrid>
            <Pagination basePath={basePath} query={query} meta={meta} className="mt-2" />
          </>
        ) : (
          <ListingEmptyState
            message="No products match these filters."
            actionLabel="Clear filters"
            actionHref={basePath}
          />
        )}
      </ProductListingShell>
    </div>
  );
}
