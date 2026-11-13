import { createLocalStore } from '../local-store';

/**
 * Whether the admin sidebar is the narrow icon rail. Kept in `localStorage` so the choice survives
 * reloads and is the same in every tab; the server render and hydration see the expanded fallback.
 * The toggle lives in the top bar, so both components read this one store.
 */
export const sidebarCollapsedStore = createLocalStore<boolean>({
  key: 'aricon_admin_sidebar_collapsed',
  fallback: false,
  parse: (raw) => raw === '1',
  serialize: (collapsed) => (collapsed ? '1' : null),
});
