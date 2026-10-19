import { formatNumber } from '@aricon/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ActiveFilterChips, countActiveFilters } from '@/components/shop/active-filter-chips';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';
import { FilterPanel } from '@/components/shop/filter-panel';
import { breadcrumbList, JsonLd } from '@/components/shop/json-ld';
import { Pagination } from '@/components/shop/pagination';
import { ProductCard } from '@/components/shop/product-card';
import { ProductGrid } from '@/components/shop/product-grid';
import { ListingEmptyState, ProductListingShell } from '@/components/shop/product-listing';
import { SortSelect } from '@/components/shop/sort-select';
import { getCategory, getProducts, orNotFound } from '@/lib/api-server';
import { parseProductSearchParams, type SearchParamsInput } from '@/lib/product-query';
import { routes } from '@/lib/routes';
import { absoluteUrl } from '@/lib/site';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await orNotFound(getCategory(slug));
  return {
    title: category.name,
    description: category.description ?? `Shop ${category.name} at bulk prices, delivered across Karachi.`,
    alternates: { canonical: routes.category(slug) },
    openGraph: { title: category.name, url: routes.category(slug), type: 'website' },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const rawSearchParams = await searchParams;
  const query = parseProductSearchParams(rawSearchParams as SearchParamsInput);

  const [{ category, parent, children, breadcrumbs }, { data, meta, facets }] = await Promise.all([
    orNotFound(getCategory(slug)),
    orNotFound(getProducts({ ...query, category: slug })),
  ]);

  const basePath = routes.category(slug);
  const isTopLevel = parent === null;

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-6 md:px-8 md:py-10">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', url: absoluteUrl(routes.home) },
          ...breadcrumbs.map((crumb) => ({ name: crumb.name, url: absoluteUrl(routes.category(crumb.slug)) })),
        ])}
      />
      <Breadcrumbs items={breadcrumbs.slice(0, -1)} current={category.name} />

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="type-h1">{category.name}</h1>
          <p className="text-sm text-ink-700 tabular-nums">{formatNumber(meta.total)} products</p>
        </div>
        {category.description ? <p className="max-w-[70ch] text-ink-700">{category.description}</p> : null}
      </div>

      {isTopLevel && children.length > 0 ? (
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none md:mx-0 md:flex-wrap md:px-0">
          {children.map((child) => (
            <li key={child.id} className="shrink-0">
              <Link
                href={routes.category(child.slug)}
                className="flex min-h-9 items-center rounded-full border border-concrete-200 bg-surface px-3.5 text-sm font-medium text-ink-700 hover:border-concrete-400 hover:text-ink"
              >
                {child.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <ProductListingShell
        total={meta.total}
        activeFilterCount={countActiveFilters(query)}
        mobileFilterPanel={<FilterPanel query={query} facets={facets} basePath={basePath} idPrefix="mobile" />}
        desktopFilterPanel={<FilterPanel query={query} facets={facets} basePath={basePath} idPrefix="desktop" />}
        sortSelect={<SortSelect currentSort={query.sort} />}
        activeChips={<ActiveFilterChips query={query} facets={facets} basePath={basePath} />}
      >
        {data.length > 0 ? (
          <>
            <ProductGrid aria-label={category.name}>
              {data.map((product) => (
                <ProductCard key={product.id} product={product} categoryHint={category.slug} />
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
