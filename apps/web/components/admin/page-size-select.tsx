'use client';

import { DEFAULT_PAGE_SIZE } from '@aricon/shared';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/select';
import { buildAdminHref } from '@/lib/admin/query-string';
import { PAGE_SIZE_OPTIONS } from '@/lib/admin/page-size';

export interface PageSizeSelectProps {
  basePath: string;
  /** The list's current filters, kept when the size changes. */
  query: Record<string, string | number | undefined>;
  pageSize: number;
}

/** "Rows per page" dropdown of an admin list: reloads the list at page 1 with `?pageSize=`. */
export function PageSizeSelect({ basePath, query, pageSize }: PageSizeSelectProps) {
  const router = useRouter();

  function change(value: string) {
    const size = Number(value);
    router.push(
      buildAdminHref(basePath, { ...query, page: undefined, pageSize: size === DEFAULT_PAGE_SIZE ? undefined : size }),
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-cement">
      <label htmlFor="admin-page-size" className="whitespace-nowrap">
        Rows per page
      </label>
      <div className="w-20">
        <Select
          id="admin-page-size"
          size="xs"
          value={String(pageSize)}
          onValueChange={change}
          options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: String(size) }))}
        />
      </div>
    </div>
  );
}
