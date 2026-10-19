import { useSyncExternalStore } from 'react';

const subscribeNever = () => () => {};

/**
 * False during the server render and hydration, true once the component runs in the browser.
 * Use it to gate anything read from browser-only storage, so the first client render matches the
 * server HTML (no hydration mismatch) without a mount effect that calls `setState`.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
