import { DEFAULT_PAGE_SIZE, type PageMeta, type ProductListQuery } from '@aricon/shared';
import {
  Pagination as PaginationNav,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { buildListingHref } from '@/lib/product-query';

export interface PaginationProps {
  basePath: string;
  query: ProductListQuery;
  meta: PageMeta;
  className?: string;
}

/** "Previous / 1 2 3 … / Next" (DESIGN.md §8.3). Renders nothing when everything fits on one page. */
export function Pagination({ basePath, query, meta, className }: PaginationProps) {
  const pageSize = meta.pageSize || DEFAULT_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(meta.total / pageSize));
  if (pageCount <= 1) return null;

  const current = Math.min(Math.max(meta.page, 1), pageCount);
  const hrefFor = (page: number) => buildListingHref(basePath, { ...query, page });
  const pages = pageNumbers(current, pageCount);

  return (
    <PaginationNav className={className}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href={current > 1 ? hrefFor(current - 1) : undefined} disabled={current <= 1} />
        </PaginationItem>
        {pages.map((page, index) =>
          page === 'ellipsis' ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={page}>
              <PaginationLink href={hrefFor(page)} isActive={page === current} aria-label={`Page ${page}`}>
                {page}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext href={current < pageCount ? hrefFor(current + 1) : undefined} disabled={current >= pageCount} />
        </PaginationItem>
      </PaginationContent>
    </PaginationNav>
  );
}

/** First, last, current and its neighbours; gaps become a single "…". */
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
