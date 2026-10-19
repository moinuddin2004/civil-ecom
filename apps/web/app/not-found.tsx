import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { routes } from '@/lib/routes';

// App Router convention (SPEC §8.1): global 404. It sits outside the (shop) route group, so it
// renders inside the root layout only — no shop header/footer — hence its own small wordmark link.
export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Link href={routes.home} className="font-display text-lg font-bold tracking-wordmark text-ink">
        ARICON <span className="text-blueprint">Shop</span>
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="type-h1">We couldn&apos;t find that page.</h1>
        <p className="max-w-[48ch] text-ink-700">
          The page may have moved, or the link might be out of date. Try searching for what you need.
        </p>
      </div>

      <form action="/search" method="get" className="flex w-full max-w-105 gap-2">
        <label htmlFor="not-found-search" className="sr-only">
          Search products
        </label>
        <div className="relative flex-1">
          <Search
            aria-hidden
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-cement"
          />
          <Input id="not-found-search" name="q" type="search" placeholder="Search cement, wires, pipes…" className="pl-11" />
        </div>
        <Button type="submit" size="lg">
          Search
        </Button>
      </form>

      <Button asChild variant="secondary" size="lg">
        <Link href={routes.home}>Back to home</Link>
      </Button>
    </div>
  );
}
