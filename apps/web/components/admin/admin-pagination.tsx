import { DEFAULT_PAGE_SIZE } from '@aricon/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { buildAdminHref } from '@/lib/admin/query-string';
import { cn } from '@/lib/utils';

export interface AdminPaginationProps {
  basePath: string;
  query: Record<string, string | number | undefined>;
  meta: { page: number; pageSize: number; total: number };
  className?: string;
}

/**
 * "Previous / 1 2 3 … / Next" for the admin orders and stock-movements tables — the same shape as
 * the storefront's `components/shop/pagination.tsx`, built on the generic `buildAdminHref()`
 * instead of the product-listing query type. Renders nothing when everything fits on one page.
 */
export function AdminPagination({ basePath, query, meta, className }: AdminPaginationProps) {
  const pageSize = meta.pageSize || DEFAULT_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(meta.total / pageSize));
  if (pageCount <= 1) return null;

  const current = Math.min(Math.max(meta.page, 1), pageCount);
  const hrefFor = (page: number) => buildAdminHref(basePath, { ...query, page });
  const pages = pageNumbers(current, pageCount);

  return (
    <nav aria-label="Pagination" className={cn('flex flex-wrap items-center justify-center gap-1', className)}>
      <PageLink href={current > 1 ? hrefFor(current - 1) : undefined} disabled={current <= 1} aria-label="Previous page">
        <ChevronLeft aria-hidden strokeWidth={1.75} className="size-4" />
        <span className="hidden sm:inline">Previous</span>
      </PageLink>

      {pages.map((page, index) =>
        page === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="px-2 text-cement" aria-hidden="true">
            …
          </span>
        ) : (
          <PageLink key={page} href={hrefFor(page)} active={page === current} aria-label={`Page ${page}`}>
            {page}
          </PageLink>
        ),
      )}

      <PageLink href={current < pageCount ? hrefFor(current + 1) : undefined} disabled={current >= pageCount} aria-label="Next page">
        <span className="hidden sm:inline">Next</span>
        <ChevronRight aria-hidden strokeWidth={1.75} className="size-4" />
      </PageLink>
    </nav>
  );
}

function pageNumbers(current: number, pageCount: number): (number | 'ellipsis')[] {
  const candidates = new Set<number>([1, pageCount, current - 1, current, current + 1]);
  const sorted = Array.from(candidates)
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b);

  const result: (number | 'ellipsis')[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push('ellipsis');
    result.push(page);
    previous = page;
  }
  return result;
}

type PageLinkProps = {
  href?: string;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
} & Omit<ComponentProps<'a'>, 'href' | 'children'>;

function PageLink({ href, active, disabled, children, ...props }: PageLinkProps) {
  const classes = cn(
    'flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-3 text-sm font-medium',
    active ? 'bg-ink text-white' : 'text-ink-700 hover:bg-concrete-50',
    disabled && 'pointer-events-none text-concrete-400',
  );
  if (!href || disabled) {
    return (
      <span aria-disabled="true" className={classes} {...props}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={classes} {...props}>
      {children}
    </Link>
  );
}
