import { Lock } from 'lucide-react';

/** Shown instead of a page's content when the signed-in staff lacks the permission it needs (DESIGN.md §9.6). */
export function AccessDenied() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-concrete-150 bg-surface px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-concrete-100 text-cement">
        <Lock aria-hidden strokeWidth={1.75} className="size-6" />
      </span>
      <h1 className="type-h2">Access denied</h1>
      <p className="max-w-[44ch] text-ink-700">You don&apos;t have access to this page. Ask an admin for permission.</p>
    </div>
  );
}
