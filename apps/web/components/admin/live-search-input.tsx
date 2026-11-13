'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useEffectEvent, useState, useTransition, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';

export interface LiveSearchInputProps extends Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'defaultValue' | 'name'> {
  /** The query-string parameter this box edits (`q` for orders, products and customers; `sku` for stock history). */
  name?: string;
  defaultValue?: string;
}

/**
 * Search box of a server-rendered admin list. Once typing pauses (`useDebouncedValue`), the page's
 * query string is updated (`?q=…`, other filters kept, page reset) and the list reloads with the
 * results, so staff don't have to press Filter. It still has a `name`, so pressing Enter or
 * "Filter" submits the plain GET form as before. If the URL's value changes from outside (the
 * "Clear" link), the box follows it.
 */
export function LiveSearchInput({ name = 'q', defaultValue = '', ...props }: LiveSearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [value, setValue] = useState(defaultValue);
  const fromUrl = searchParams.get(name) ?? '';

  // Follow the URL when something else changes it, but never overwrite what is being typed.
  const [seenUrlValue, setSeenUrlValue] = useState(fromUrl);
  if (fromUrl !== seenUrlValue) {
    setSeenUrlValue(fromUrl);
    if (fromUrl !== value.trim()) setValue(fromUrl);
  }

  const debounced = useDebouncedValue(value.trim());

  const updateUrl = useEffectEvent((next: string) => {
    if (next === fromUrl) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set(name, next);
    else params.delete(name);
    params.delete('page');
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
  });

  useEffect(() => {
    updateUrl(debounced);
  }, [debounced]);

  return <Input {...props} name={name} value={value} onChange={(event) => setValue(event.target.value)} autoComplete="off" />;
}
