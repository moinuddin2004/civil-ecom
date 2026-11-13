import { useEffect, useState } from 'react';

/** How long typing has to pause before a search or live lookup runs (one value for every search box). */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * `value`, but only after it has stopped changing for `ms`. Use it on the text of a search box and
 * run the request from the debounced value, so the API isn't called on every key press. The first
 * render returns `value` as it is.
 *
 * @example
 * const [query, setQuery] = useState('');
 * const debounced = useDebouncedValue(query);
 * useQuery({ queryKey: ['search', debounced], queryFn: ..., enabled: debounced.length >= 2 });
 */
export function useDebouncedValue<T>(value: T, ms: number = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
