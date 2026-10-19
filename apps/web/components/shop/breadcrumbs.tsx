import type { BreadcrumbDTO } from '@aricon/shared';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { routes } from '@/lib/routes';
import { iconProps } from './styles';

export interface BreadcrumbsProps {
  items: BreadcrumbDTO[];
  /** The current page's title, shown last and not linked (e.g. the product name). */
  current: string;
  className?: string;
}

/** Category/product breadcrumb trail (SPEC §8.5/§14 `BreadcrumbList`). */
export function Breadcrumbs({ items, current, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-cement">
        <li>
          <Link href={routes.home} className="hover:text-ink">
            Home
          </Link>
        </li>
        {items.map((item) => (
          <li key={item.slug} className="flex items-center gap-1">
            <ChevronRight {...iconProps} className="size-3.5 shrink-0" />
            <Link href={routes.category(item.slug)} className="hover:text-ink">
              {item.name}
            </Link>
          </li>
        ))}
        <li className="flex items-center gap-1 text-ink" aria-current="page">
          <ChevronRight {...iconProps} className="size-3.5 shrink-0" />
          <span className="line-clamp-1">{current}</span>
        </li>
      </ol>
    </nav>
  );
}
