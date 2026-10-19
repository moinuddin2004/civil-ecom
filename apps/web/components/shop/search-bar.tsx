'use client';

import { formatPKR } from '@aricon/shared';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchSuggestions } from '@/lib/search';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';
import { ProductImage } from './product-image';
import { iconProps } from './styles';

export interface SearchBarProps {
  className?: string;
  /** Desktop bar is wider and sits inline in the header; mobile is the full-width row below it. */
  size?: 'md' | 'lg';
}

/** Every suggestion row, in the order the keyboard moves through them. */
interface FlatRow {
  kind: 'product' | 'category' | 'brand';
  href: string;
  label: string;
}

/** Header search with grouped suggestions (SPEC §8.2, DESIGN.md §6 "Search with suggestions"). */
export function SearchBar({ className, size = 'lg' }: SearchBarProps) {
  const router = useRouter();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useSearchSuggestions(debounced);
  const hasResults = results.products.length + results.categories.length + results.brands.length > 0;
  const showPanel = open && debounced.trim().length >= 2;

  const rows: FlatRow[] = [
    ...results.products.map((product) => ({ kind: 'product' as const, href: routes.product(product.slug), label: product.name })),
    ...results.categories.map((category) => ({ kind: 'category' as const, href: routes.category(category.slug), label: category.name })),
    ...results.brands.map((brand) => ({ kind: 'brand' as const, href: routes.brand(brand.slug), label: brand.name })),
  ];

  function go(href: string) {
    setOpen(false);
    inputRef.current?.blur();
    router.push(href);
  }

  function submitSearch() {
    const q = query.trim();
    if (q) go(routes.search(q));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, rows.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === 'Enter') {
      const active = activeIndex >= 0 ? rows[activeIndex] : undefined;
      if (active) go(active.href);
      else submitSearch();
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-transparent bg-surface px-3.5 text-ink',
          'focus-within:border-blueprint',
          size === 'lg' ? 'h-12' : 'h-10',
        )}
      >
        <Search {...iconProps} className="size-5 shrink-0 text-cement" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          type="search"
          value={query}
          placeholder="Search cement, wires, pipes..."
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-cement"
        />
      </div>

      {showPanel ? (
        <>
          {/* Closes the panel on outside click without extra JS: a full-screen invisible layer. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            id={listboxId}
            role="listbox"
            className="absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-[70vh] overflow-y-auto rounded-md border border-concrete-150 bg-surface shadow-float"
          >
            {hasResults ? (
              <div className="flex flex-col gap-1 py-2">
                {results.products.length > 0 ? (
                  <SuggestGroup label="Products">
                    {results.products.map((product) => {
                      const index = rows.findIndex((row) => row.kind === 'product' && row.href === routes.product(product.slug));
                      return (
                        <SuggestRow
                          key={product.id}
                          active={index === activeIndex}
                          onClick={() => go(routes.product(product.slug))}
                        >
                          <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-concrete-50">
                            <ProductImage imageKey={product.imageKey} alt="" sizes="40px" placeholderHint={product.name} placeholderSize={22} />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm text-ink">{product.name}</span>
                            <span className="text-xs text-cement">{product.brandName}</span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">{formatPKR(product.minPrice)}</span>
                        </SuggestRow>
                      );
                    })}
                  </SuggestGroup>
                ) : null}

                {results.categories.length > 0 ? (
                  <SuggestGroup label="Categories">
                    {results.categories.map((category) => {
                      const index = rows.findIndex((row) => row.kind === 'category' && row.href === routes.category(category.slug));
                      return (
                        <SuggestRow key={category.slug} active={index === activeIndex} onClick={() => go(routes.category(category.slug))}>
                          <span className="text-sm text-ink">{category.name}</span>
                        </SuggestRow>
                      );
                    })}
                  </SuggestGroup>
                ) : null}

                {results.brands.length > 0 ? (
                  <SuggestGroup label="Brands">
                    {results.brands.map((brand) => {
                      const index = rows.findIndex((row) => row.kind === 'brand' && row.href === routes.brand(brand.slug));
                      return (
                        <SuggestRow key={brand.slug} active={index === activeIndex} onClick={() => go(routes.brand(brand.slug))}>
                          <span className="text-sm text-ink">{brand.name}</span>
                        </SuggestRow>
                      );
                    })}
                  </SuggestGroup>
                ) : null}

                <button
                  type="button"
                  onClick={submitSearch}
                  className="mx-2 mt-1 rounded-md px-2 py-2 text-left text-sm font-medium text-blueprint hover:bg-concrete-50 hover:text-blueprint-700"
                >
                  See all results for &ldquo;{debounced}&rdquo;
                </button>
              </div>
            ) : (
              <p className="px-4 py-6 text-sm text-ink-700">
                No matches for &ldquo;{debounced}&rdquo;. Try a brand or product type.
              </p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function SuggestGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-4 pt-1.5 pb-0.5 text-xs font-semibold tracking-wide text-cement uppercase">{label}</p>
      {children}
    </div>
  );
}

function SuggestRow({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex min-h-11 w-full items-center gap-3 px-4 py-1.5 text-left',
        active ? 'bg-concrete-50' : 'hover:bg-concrete-50',
      )}
    >
      {children}
    </button>
  );
}
