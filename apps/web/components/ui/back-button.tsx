'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';
import { cn } from '@/lib/utils';

export interface BackButtonProps {
  /** Where "Back" goes when there is no earlier page of this site (opened from a bookmark or a new tab). */
  fallbackHref: string;
  /** Button text; defaults to "Back". */
  label?: string;
  className?: string;
}

/**
 * "Back" for pages that sit inside another page (an order inside the orders list, a product inside
 * a category, …). It takes the visitor one page back in their own history, so the list they came
 * from keeps its filters, search and page. It is a real link to `fallbackHref`, so it also works
 * without JavaScript and when the page was opened directly.
 */
export function BackButton({ fallbackHref, label = 'Back', className }: BackButtonProps) {
  const router = useRouter();

  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    // Only when the previous page is on this site; a plain click (no new-tab shortcut).
    const cameFromHere = document.referrer !== '' && new URL(document.referrer).origin === window.location.origin;
    if (cameFromHere && window.history.length > 1 && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) {
      event.preventDefault();
      router.back();
    }
  }

  return (
    <Link
      href={fallbackHref}
      onClick={goBack}
      className={cn(
        'inline-flex min-h-10 w-fit items-center gap-1.5 rounded-md pr-2 text-sm font-medium text-ink-700 hover:text-ink',
        className,
      )}
    >
      <ArrowLeft aria-hidden strokeWidth={1.75} className="size-4.5" />
      {label}
    </Link>
  );
}
