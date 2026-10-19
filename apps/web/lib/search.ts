'use client';

import { SUGGEST_MIN_QUERY, type ApiResponse, type SearchSuggestDTO } from '@aricon/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from './api-client';

const NO_SUGGESTIONS: SearchSuggestDTO = { products: [], categories: [], brands: [] };

/**
 * Search-as-you-type (`GET /api/search/suggest?q=`, SPEC §7.2): up to 6 products, 3 categories and
 * 3 brands. Below 2 characters nothing is asked. Each text is cached for a minute, and the previous
 * suggestions stay on screen while the next ones load, so the list doesn't flicker as people type.
 */
export function useSearchSuggestions(query: string): SearchSuggestDTO {
  const q = query.trim();
  const enabled = q.length >= SUGGEST_MIN_QUERY;
  const { data } = useQuery({
    queryKey: ['search-suggest', q.toLowerCase()],
    queryFn: async ({ signal }) =>
      (await apiClient<ApiResponse<SearchSuggestDTO>>(`/search/suggest?q=${encodeURIComponent(q)}`, { signal })).data,
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  return enabled && data ? data : NO_SUGGESTIONS;
}
