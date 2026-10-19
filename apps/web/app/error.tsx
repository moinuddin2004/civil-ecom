'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { routes } from '@/lib/routes';

// Root error boundary (Next.js App Router convention: must be a Client Component). Catches errors
// thrown while rendering a page inside the root layout. `error.message` / stack are never shown to
// the user — production responses must not leak internals (CLAUDE.md §11) — only logged for
// whoever has devtools open.
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-danger-50">
        <AlertTriangle aria-hidden strokeWidth={1.75} className="size-7 text-danger" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="type-h1">Something went wrong.</h1>
        <p className="max-w-[48ch] text-ink-700">
          We hit a snag loading this page. Please try again, or head back to the home page.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href={routes.home}>Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
