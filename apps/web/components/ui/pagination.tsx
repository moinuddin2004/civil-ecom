import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * shadcn/ui Pagination, themed with the v2 tokens: `Pagination > PaginationContent > PaginationItem >
 * PaginationLink | PaginationPrevious | PaginationNext | PaginationEllipsis`. Links are Next.js
 * `Link`s so every page is a normal URL (server-rendered lists, no client state). A disabled
 * previous/next renders as a non-interactive `span`.
 */
function Pagination({ className, ...props }: ComponentProps<'nav'>) {
  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      data-slot="pagination"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: ComponentProps<'ul'>) {
  return <ul data-slot="pagination-content" className={cn('flex flex-row flex-wrap items-center justify-center gap-1', className)} {...props} />;
}

function PaginationItem(props: ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
  /** The current page: outlined and `aria-current="page"`. */
  isActive?: boolean;
  /** Not clickable (e.g. "Previous" on page 1). */
  disabled?: boolean;
  /** Set `size="icon"` for numbers; text links (Previous/Next) use `default`. */
  size?: 'default' | 'icon';
} & Omit<ComponentProps<typeof Link>, 'href'> & { href?: string };

function PaginationLink({ className, isActive, disabled, size = 'icon', href, children, ...props }: PaginationLinkProps) {
  const classes = cn(
    buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: size === 'icon' ? 'icon' : 'md' }),
    size === 'default' && 'gap-1 px-3 text-sm',
    size === 'icon' && 'text-sm',
    disabled && 'pointer-events-none text-concrete-400',
    className,
  );
  if (!href || disabled) {
    return (
      <span aria-disabled="true" data-slot="pagination-link" className={classes}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={classes}
      {...props}
    >
      {children}
    </Link>
  );
}

function PaginationPrevious({ className, ...props }: Omit<PaginationLinkProps, 'size' | 'children'>) {
  return (
    <PaginationLink aria-label="Previous page" size="default" className={cn('pl-2.5', className)} {...props}>
      <ChevronLeft aria-hidden strokeWidth={1.75} className="size-4" />
      <span className="hidden sm:inline">Previous</span>
    </PaginationLink>
  );
}

function PaginationNext({ className, ...props }: Omit<PaginationLinkProps, 'size' | 'children'>) {
  return (
    <PaginationLink aria-label="Next page" size="default" className={cn('pr-2.5', className)} {...props}>
      <span className="hidden sm:inline">Next</span>
      <ChevronRight aria-hidden strokeWidth={1.75} className="size-4" />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span aria-hidden data-slot="pagination-ellipsis" className={cn('flex size-11 items-center justify-center text-cement', className)} {...props}>
      <MoreHorizontal className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious };
