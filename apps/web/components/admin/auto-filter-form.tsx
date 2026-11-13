'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useEffectEvent, useRef, useTransition, type ReactNode } from 'react';

/** How long after the last change the list reloads (a short pause, so a few quick clicks make one reload). */
const APPLY_DELAY_MS = 150;

export interface AutoFilterFormProps {
  /** The list's path; defaults to the current page. */
  action?: string;
  className?: string;
  children: ReactNode;
}

/** The query string as a sorted `key=value` list, without `page`, so two URLs can be compared. */
function signature(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([key]) => key !== 'page')
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('&');
}

/**
 * The filter bar of a server-rendered admin list. It is still a plain GET form (Enter submits it),
 * but any change to its fields (a select, a checkbox, a date) applies the filters by itself: the
 * URL is rebuilt from the form's fields, `pageSize` is kept, `page` goes back to 1, and the list
 * reloads. No Filter or Apply button needed. Text boxes use `LiveSearchInput`, which does the same
 * for typing.
 */
export function AutoFilterForm({ action, className, children }: AutoFilterFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const apply = useEffectEvent(() => {
    const form = formRef.current;
    if (!form) return;
    const next = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === 'string' && value.trim() !== '') next.set(key, value.trim());
    }
    const pageSize = searchParams.get('pageSize');
    if (pageSize) next.set('pageSize', pageSize);
    if (signature(next) === signature(new URLSearchParams(searchParams.toString()))) return;

    const query = next.toString();
    const base = action ?? pathname;
    startTransition(() => router.replace(query ? `${base}?${query}` : base));
  });

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const schedule = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => apply(), APPLY_DELAY_MS);
    };
    // `click` as well as `change`: a checkbox from the UI kit reports its new state through a hidden input.
    form.addEventListener('change', schedule);
    form.addEventListener('click', schedule);
    return () => {
      window.clearTimeout(timer.current);
      form.removeEventListener('change', schedule);
      form.removeEventListener('click', schedule);
    };
  }, []);

  return (
    <form ref={formRef} method="get" action={action} className={className}>
      {children}
    </form>
  );
}
