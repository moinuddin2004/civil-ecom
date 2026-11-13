'use client';

import type { CategoryNode } from '@aricon/shared';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { routes } from '@/lib/routes';
import { CategoryGlyph } from './category-glyph';

export interface CategoryMenuProps {
  categories: CategoryNode[];
  /** The hamburger icon (mobile) vs. the "All categories" button (desktop). */
  trigger: ReactNode;
}

/**
 * Every department and its categories in one dialog (SPEC §5.1/§8.2): a mobile drawer and the
 * desktop "All categories" mega menu share this component instead of two separate patterns.
 */
export function CategoryMenu({ categories, trigger }: CategoryMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent mobile="sheet" size="xl" aria-describedby={undefined} className="lg:max-h-[calc(100dvh-4rem)]">
        <DialogHeader>
          <DialogTitle>All categories</DialogTitle>
          <DialogCloseButton />
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <div key={category.id} className="flex flex-col gap-2">
                <Link
                  href={routes.category(category.slug)}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 font-semibold text-ink hover:text-blueprint"
                >
                  <CategoryGlyph hint={category.slug} size={20} />
                  {category.name}
                </Link>
                {category.children.length > 0 ? (
                  <ul className="flex flex-col gap-0.5 pl-7">
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={routes.category(child.slug)}
                          onClick={() => setOpen(false)}
                          className="flex min-h-9 items-center text-sm text-ink-700 hover:text-blueprint"
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/** Mobile hamburger trigger button. */
export function CategoryMenuButton() {
  return (
    <button type="button" aria-label="All categories" className="flex size-11 items-center justify-center text-ink">
      <Menu aria-hidden strokeWidth={1.75} className="size-6" />
    </button>
  );
}
