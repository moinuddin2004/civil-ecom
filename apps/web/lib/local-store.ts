import { useSyncExternalStore } from 'react';

/**
 * One value persisted in `localStorage`, read through `useSyncExternalStore` so React never sees a
 * torn or stale value and no component needs a mount effect that calls `setState`. Changes made in
 * another tab arrive through the `storage` event.
 *
 * When storage is unavailable (private browsing, blocked, quota full) the value lives in memory for
 * the rest of the page view instead, so the UI keeps working.
 */
export interface LocalStore<T> {
  /** Current value; the same reference until the stored text changes. */
  get: () => T;
  set: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
  /** What the server render and hydration see, and what a missing or unreadable value becomes. */
  fallback: T;
}

export interface LocalStoreOptions<T> {
  key: string;
  /** Must be a stable reference (a module constant), since it is returned as a snapshot. */
  fallback: T;
  /** Stored text → value; return null (or throw) for anything unreadable. */
  parse: (raw: string) => T | null;
  /** Value → stored text; null removes the key. */
  serialize: (value: T) => string | null;
}

export function createLocalStore<T>({ key, fallback, parse, serialize }: LocalStoreOptions<T>): LocalStore<T> {
  const listeners = new Set<() => void>();
  /** Set when a write to `localStorage` failed: the in-memory text wins from then on. */
  let memory: { raw: string | null } | null = null;
  let cachedRaw: string | null = null;
  let cachedValue: T = fallback;

  function readRaw(): string | null {
    if (memory) return memory.raw;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function get(): T {
    const raw = readRaw();
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    if (raw === null) {
      cachedValue = fallback;
    } else {
      try {
        cachedValue = parse(raw) ?? fallback;
      } catch {
        cachedValue = fallback;
      }
    }
    return cachedValue;
  }

  function set(value: T): void {
    const raw = serialize(value);
    try {
      if (raw === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, raw);
      memory = null;
    } catch {
      memory = { raw };
    }
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) listener();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  }

  return { get, set, subscribe, fallback };
}

/** The store's current value; `store.fallback` during the server render and hydration. */
export function useLocalStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, () => store.fallback);
}
