import { isServer, QueryClient } from '@tanstack/react-query';
import { isApiError } from './api-errors';

/** 4xx answers are final (validation, auth, not found): retrying only repeats them. */
function isClientError(error: unknown): boolean {
  return isApiError(error) && error.status >= 400 && error.status < 500;
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // One retry for network trouble and 5xx; none for 4xx.
        retry: (failureCount, error) => failureCount < 1 && !isClientError(error),
      },
      mutations: { retry: false },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * The browser keeps one client for the whole visit (the cart and the logged-in customer live in
 * it); every server render gets a fresh one so nothing leaks between visitors.
 * Code outside React (cart merge after login, sign out) uses the same browser client.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
