'use client';

import { Toaster as SonnerToaster } from 'sonner';
import { useEffect, useState } from 'react';

/**
 * App-wide toast host (DESIGN.md §6 "Toast"): bottom-center on mobile, bottom-right on desktop.
 * Mounted once in the root layout; trigger toasts anywhere with `toast(...)` from `sonner`.
 */
export function Toaster() {
  const [position, setPosition] = useState<'bottom-center' | 'bottom-right'>('bottom-center');

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setPosition(query.matches ? 'bottom-right' : 'bottom-center');
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return (
    <SonnerToaster
      position={position}
      gap={8}
      toastOptions={{
        classNames: {
          toast: 'rounded-md! border! border-concrete-150! bg-ink! text-white! shadow-float! font-sans!',
          title: 'text-white!',
          description: 'text-concrete-200!',
          actionButton: 'bg-amber! text-ink!',
          cancelButton: 'bg-ink-700! text-white!',
        },
      }}
    />
  );
}
