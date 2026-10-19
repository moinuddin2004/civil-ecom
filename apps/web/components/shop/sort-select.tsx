'use client';

import { PRODUCT_SORT_LABELS, PRODUCT_SORTS } from '@aricon/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ChangeEvent } from 'react';
import { Select } from '@/components/ui/select';

export interface SortSelectProps {
  /** Current `?sort=`, or undefined for the default (Relevance). */
  currentSort?: string;
  className?: string;
}

/**
 * Sort dropdown (DESIGN.md §8.3 "Sort: [Relevance ▾]"). Navigates to the same path with `sort`
 * updated and every other filter kept, resetting `page` back to 1. A small, isolated client
 * component: the rest of the listing (filters, grid, pagination) stays server-rendered.
 */
export function SortSelect({ currentSort, className }: SortSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('sort', value);
    else params.delete('sort');
    params.delete('page');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className={className}>
      <label htmlFor="listing-sort" className="sr-only">
        Sort
      </label>
      <Select
        id="listing-sort"
        name="sort"
        size="md"
        value={currentSort ?? 'relevance'}
        onChange={handleChange}
        wrapperClassName="w-full"
        options={PRODUCT_SORTS.map((sort) => ({ value: sort, label: PRODUCT_SORT_LABELS[sort] }))}
      />
    </div>
  );
}
