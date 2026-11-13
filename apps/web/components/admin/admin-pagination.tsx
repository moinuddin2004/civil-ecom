import { DEFAULT_PAGE_SIZE } from "@aricon/shared";
import { PageSizeSelect } from "@/components/admin/page-size-select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { PAGE_SIZE_OPTIONS } from "@/lib/admin/page-size";
import { buildAdminHref } from "@/lib/admin/query-string";
import { cn } from "@/lib/utils";

export interface AdminPaginationProps {
  basePath: string;
  query: Record<string, string | number | undefined>;
  meta: { page: number; pageSize: number; total: number };
  className?: string;
}

/**
 * "Previous / 1 2 3 … / Next" for the admin orders and stock-movements tables — the same shape as
 * the storefront's `components/shop/pagination.tsx`, built on the generic `buildAdminHref()`
 * instead of the product-listing query type. Next to the page links sits a "Rows per page" choice
 * (`?pageSize=`, kept on every link). Renders nothing when even the smallest page size fits it all.
 */
export function AdminPagination({
  basePath,
  query,
  meta,
  className,
}: AdminPaginationProps) {
  const pageSize = meta.pageSize || DEFAULT_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(meta.total / pageSize));
  if (meta.total <= PAGE_SIZE_OPTIONS[0]) return null;

  const current = Math.min(Math.max(meta.page, 1), pageCount);
  const sizeQuery =
    pageSize === DEFAULT_PAGE_SIZE ? query : { ...query, pageSize };
  const hrefFor = (page: number) =>
    buildAdminHref(basePath, { ...sizeQuery, page });
  const pages = pageNumbers(current, pageCount);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 sm:flex-row sm:justify-between",
        className,
      )}
    >
      <PageSizeSelect basePath={basePath} query={query} pageSize={pageSize} />
      {pageCount > 1 ? (
        <Pagination className="sm:mx-0 sm:w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={current > 1 ? hrefFor(current - 1) : undefined}
                disabled={current <= 1}
              />
            </PaginationItem>
            {pages.map((page, index) =>
              page === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={page}>
                  <PaginationLink
                    href={hrefFor(page)}
                    isActive={page === current}
                    aria-label={`Page ${page}`}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                href={current < pageCount ? hrefFor(current + 1) : undefined}
                disabled={current >= pageCount}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}

function pageNumbers(
  current: number,
  pageCount: number,
): (number | "ellipsis")[] {
  const candidates = new Set<number>([
    1,
    pageCount,
    current - 1,
    current,
    current + 1,
  ]);
  const sorted = Array.from(candidates)
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push("ellipsis");
    result.push(page);
    previous = page;
  }
  return result;
}
