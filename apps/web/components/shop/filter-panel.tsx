import { FILTER_KEYS, FILTER_LABELS, type ProductFacets, type ProductListQuery } from '@aricon/shared';
import { Check } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { buildListingHref, withFilterValues, withoutPage } from '@/lib/product-query';
import { cn } from '@/lib/utils';
import { FilterDropdown } from './filter-dropdown';

/**
 * Facet/filter UI (DESIGN.md §6 "Filter panel", SPEC §7.2): collapsible groups (shadcn Accordion), each
 * facet value as a link that adds/removes itself from the query string (checked state drawn from the
 * current query, not component state) and a price range as a plain `method="get"` form. The same
 * markup is rendered once for the desktop sidebar and once for the mobile sheet (see
 * `product-listing.tsx`); `idPrefix` keeps their input ids unique since both can be in the DOM at
 * once.
 */
export interface FilterPanelProps {
  query: ProductListQuery;
  facets: ProductFacets;
  /** The category/brand/search path the filters apply to (query string only, no `?category=` etc). */
  basePath: string;
  idPrefix: string;
  /** Brand pages fix the brand from the URL; showing a brand facet there would be confusing. */
  hideBrand?: boolean;
  className?: string;
}

/**
 * Desktop filter bar (HomeRun-style): one dropdown per facet ("Brand ▾", "Price ▾", ...) plus an
 * "In stock" toggle, in one row above the grid. Uses the same facet links and price form as the
 * mobile sheet's `FilterPanel`, so the URL is still the only filter state.
 */
export function FilterBar({ query, facets, basePath, idPrefix, hideBrand, className }: FilterPanelProps) {
  const inStock = Boolean(query.inStock);
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {!hideBrand && facets.brands.length > 0 ? (
        <FilterDropdown label="Brand" activeCount={(query.brand ?? []).length}>
          <div className="flex flex-col gap-0.5">
            {facets.brands.map((brand) => {
              const active = (query.brand ?? []).includes(brand.slug);
              const href = buildListingHref(basePath, withoutPage({ ...query, brand: toggleValue(query.brand, brand.slug) }));
              return <FacetLink key={brand.id} href={href} active={active} label={brand.name} count={brand.count} />;
            })}
          </div>
        </FilterDropdown>
      ) : null}

      {facets.price ? (
        <FilterDropdown label="Price" activeCount={query.minPrice !== undefined || query.maxPrice !== undefined ? 1 : 0}>
          <PriceRangeForm basePath={basePath} query={query} facets={facets} idPrefix={idPrefix} />
        </FilterDropdown>
      ) : null}

      {FILTER_KEYS.map((key) => {
        const values = facets.values[key];
        if (!values || values.length < 2) return null;
        return (
          <FilterDropdown key={key} label={FILTER_LABELS[key]} activeCount={(query[key] ?? []).length}>
            <div className="flex flex-col gap-0.5">
              {values.map((facetValue) => {
                const current = query[key];
                const href = buildListingHref(basePath, withoutPage(withFilterValues(query, key, toggleValue(current, facetValue.value))));
                return (
                  <FacetLink
                    key={facetValue.value}
                    href={href}
                    active={(current ?? []).includes(facetValue.value)}
                    label={facetValue.value}
                    count={facetValue.count}
                  />
                );
              })}
            </div>
          </FilterDropdown>
        );
      })}

      <Link
        href={buildListingHref(basePath, withoutPage({ ...query, inStock: inStock ? undefined : true }))}
        aria-pressed={inStock}
        className={cn(
          'flex h-10 items-center rounded-md border px-3 text-sm font-medium whitespace-nowrap',
          inStock ? 'border-ink text-ink' : 'border-concrete-200 text-ink-700 hover:border-concrete-400 hover:text-ink',
        )}
      >
        In stock only
      </Link>
    </div>
  );
}

export function FilterPanel({ query, facets, basePath, idPrefix, hideBrand, className }: FilterPanelProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {!hideBrand && facets.brands.length > 0 ? (
        <FacetGroup title="Brand">
          {facets.brands.map((brand) => {
            const active = (query.brand ?? []).includes(brand.slug);
            const nextBrand = toggleValue(query.brand, brand.slug);
            const href = buildListingHref(basePath, withoutPage({ ...query, brand: nextBrand }));
            return <FacetLink key={brand.id} href={href} active={active} label={brand.name} count={brand.count} />;
          })}
        </FacetGroup>
      ) : null}

      {facets.price ? (
        <FacetGroup title="Price">
          <PriceRangeForm basePath={basePath} query={query} facets={facets} idPrefix={idPrefix} />
        </FacetGroup>
      ) : null}

      {FILTER_KEYS.map((key) => {
        const values = facets.values[key];
        if (!values || values.length < 2) return null;
        return (
          <FacetGroup key={key} title={FILTER_LABELS[key]}>
            {values.map((facetValue) => {
              const current = query[key];
              const active = (current ?? []).includes(facetValue.value);
              const nextValues = toggleValue(current, facetValue.value);
              const nextQuery = withoutPage(withFilterValues(query, key, nextValues));
              const href = buildListingHref(basePath, nextQuery);
              return (
                <FacetLink
                  key={facetValue.value}
                  href={href}
                  active={active}
                  label={facetValue.value}
                  count={facetValue.count}
                />
              );
            })}
          </FacetGroup>
        );
      })}

      <div className="pt-3">
        <FacetLink
          href={buildListingHref(basePath, withoutPage({ ...query, inStock: query.inStock ? undefined : true }))}
          active={Boolean(query.inStock)}
          label="In stock only"
        />
      </div>
    </div>
  );
}

function toggleValue(list: string[] | undefined, value: string): string[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function FacetGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Accordion type="single" collapsible defaultValue="group" className="border-b border-concrete-200 py-3 first:pt-0 last:border-b-0">
      <AccordionItem value="group" className="border-b-0 py-0">
        <AccordionTrigger>{title}</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-0.5">{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function FacetLink({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={cn(
        'flex min-h-11 items-center gap-2.5 rounded-md px-1.5 text-sm text-ink-700 hover:bg-concrete-50',
        active && 'font-medium text-ink',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-xs border-[1.5px] border-concrete-400 bg-surface text-white',
          active && 'border-ink bg-ink',
        )}
      >
        {active ? <Check strokeWidth={2.5} className="size-3.5" /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined ? <span className="shrink-0 text-cement tabular-nums">{count}</span> : null}
    </Link>
  );
}

/** Every other active filter as hidden fields, so submitting the price form keeps them. */
function hiddenQueryFields(query: ProductListQuery): { name: string; value: string }[] {
  const fields: { name: string; value: string }[] = [];
  if (query.q) fields.push({ name: 'q', value: query.q });
  if (query.brand && query.brand.length > 0) fields.push({ name: 'brand', value: query.brand.join(',') });
  for (const key of FILTER_KEYS) {
    const values = query[key];
    if (values && values.length > 0) fields.push({ name: key, value: values.join(',') });
  }
  if (query.inStock !== undefined) fields.push({ name: 'inStock', value: String(query.inStock) });
  if (query.sort) fields.push({ name: 'sort', value: query.sort });
  return fields;
}

function PriceRangeForm({
  basePath,
  query,
  facets,
  idPrefix,
}: {
  basePath: string;
  query: ProductListQuery;
  facets: ProductFacets;
  idPrefix: string;
}) {
  const hiddenFields = hiddenQueryFields(query);
  const priceRange = facets.price;
  return (
    <form method="get" action={basePath} className="flex flex-col gap-3">
      {hiddenFields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}
      <div className="flex items-end gap-2">
        <FormField label="Min" htmlFor={`${idPrefix}-price-min`} className="flex-1">
          <Input
            id={`${idPrefix}-price-min`}
            name="minPrice"
            type="number"
            inputMode="numeric"
            min={0}
            size="md"
            defaultValue={query.minPrice ?? ''}
            placeholder={priceRange ? String(priceRange.min) : '0'}
          />
        </FormField>
        <FormField label="Max" htmlFor={`${idPrefix}-price-max`} className="flex-1">
          <Input
            id={`${idPrefix}-price-max`}
            name="maxPrice"
            type="number"
            inputMode="numeric"
            min={0}
            size="md"
            defaultValue={query.maxPrice ?? ''}
            placeholder={priceRange ? String(priceRange.max) : undefined}
          />
        </FormField>
      </div>
      <Button type="submit" variant="secondary" size="sm" className="self-start px-4">
        Apply
      </Button>
    </form>
  );
}
