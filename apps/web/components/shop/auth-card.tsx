import type { ReactNode } from 'react';

/**
 * Centered card wrapper for login / signup / forgot / reset password (DESIGN.md §8.9: "Simple
 * centered form on concrete background"). The shop header above it already carries the logo and
 * navigation, so the card itself stays plain: a title, an optional subtitle, and the form.
 */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10 md:py-16">
      <div className="w-full max-w-105 rounded-xl border border-concrete-150 bg-surface p-6 shadow-card md:p-8">
        <h1 className="type-h1 text-center">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-center text-sm text-ink-700">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
