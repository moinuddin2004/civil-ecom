'use client';

import type { CategoryNode, DeliveryAreaDTO } from '@aricon/shared';
import { LayoutGrid, MessageCircle, Phone, ShoppingCart, User } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/lib/cart/cart-context';
import { routes } from '@/lib/routes';
import { useCustomer } from '@/lib/session/customer-session';
import { AreaSelector } from './area-selector';
import { CategoryMenu, CategoryMenuButton } from './category-menu';
import { SearchBar } from './search-bar';
import { iconProps } from './styles';

export interface HeaderProps {
  categories: CategoryNode[];
  areas: DeliveryAreaDTO[];
  whatsapp?: string | null;
  phone?: string | null;
}

/**
 * Global storefront header (SPEC §8.2, DESIGN.md §8.1): ink bar with logo, categories, search,
 * area selector, account and cart; below it a thin bar with department links and contact info on
 * desktop, or the area chip on mobile.
 */
export function Header({ categories, areas, whatsapp, phone }: HeaderProps) {
  const { pricedCart } = useCart();
  const itemCount = pricedCart.itemCount;
  const customer = useCustomer();

  return (
    <header className="sticky top-0 z-30 flex flex-col">
      <div className="bg-ink text-white">
        <div className="mx-auto flex h-14 max-w-content items-center gap-2 px-2 md:h-18 md:gap-4 md:px-8">
          <div className="lg:hidden">
            <CategoryMenu categories={categories} trigger={<CategoryMenuButton />} />
          </div>

          <Link href={routes.home} className="flex shrink-0 items-baseline gap-1.5 font-display">
            <span className="text-xl font-bold tracking-wordmark md:text-[1.625rem]">ARICON</span>
            <span className="hidden text-lg font-medium text-concrete-400 sm:inline md:text-xl">Shop</span>
          </Link>

          <div className="hidden lg:block">
            <CategoryMenu
              categories={categories}
              trigger={
                <button
                  type="button"
                  className="flex h-10 shrink-0 items-center gap-2 rounded-md bg-ink-700 px-4 text-sm font-semibold whitespace-nowrap hover:bg-ink-700/80"
                >
                  <LayoutGrid {...iconProps} className="size-4.5" />
                  All categories
                </button>
              }
            />
          </div>

          <SearchBar className="hidden flex-1 lg:block" />

          <div className="ml-auto flex items-center gap-1 md:gap-2">
            <div className="hidden md:block">
              <AreaSelector areas={areas} />
            </div>
            <Link
              href={customer ? routes.account : routes.login()}
              aria-label={customer ? 'My account' : 'Log in'}
              className="flex size-11 items-center justify-center text-white hover:text-concrete-200"
            >
              <User {...iconProps} className="size-6" />
            </Link>
            <Link
              href={routes.cart}
              aria-label={`Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}
              className="relative flex size-11 items-center justify-center text-white hover:text-concrete-200"
            >
              <ShoppingCart {...iconProps} className="size-6" />
              {itemCount > 0 ? (
                <span className="absolute top-1 right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-amber px-1 text-[11px] font-bold text-ink tabular-nums">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>

        <div className="px-2 pb-3 lg:hidden">
          <SearchBar size="md" />
        </div>
      </div>

      <div className="border-b border-concrete-150 bg-concrete-100 md:bg-surface">
        <div className="mx-auto flex h-11 max-w-content items-center gap-3 overflow-x-auto px-2 scrollbar-none md:px-8">
          <div className="md:hidden">
            <AreaSelector areas={areas} tone="onSurface" />
          </div>
          <nav className="hidden min-w-0 flex-1 items-center gap-5 overflow-x-auto scrollbar-none md:flex" aria-label="Departments">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={routes.category(category.slug)}
                className="shrink-0 text-sm font-medium text-ink hover:text-blueprint"
              >
                {category.name}
              </Link>
            ))}
          </nav>
          <div className="ml-auto hidden shrink-0 items-center gap-4 xl:flex">
            {phone ? (
              <a href={`tel:${phone.replace(/\s+/g, '')}`} className="flex items-center gap-1.5 text-sm text-ink-700 hover:text-ink">
                <Phone {...iconProps} className="size-4" />
                {phone}
              </a>
            ) : null}
            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-ink-700 hover:text-ink"
              >
                <MessageCircle {...iconProps} className="size-4" />
                WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
