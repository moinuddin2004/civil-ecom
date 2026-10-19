'use client';

import { GUEST_CART_STORAGE_KEY, type ApiResponse, type CartItem, type PricedCart } from '@aricon/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { toast } from 'sonner';
import { apiClient } from '../api-client';
import { errorMessage, isApiError } from '../api-errors';
import { useHydrated } from '../hooks/use-hydrated';
import { createLocalStore, useLocalStore } from '../local-store';
import { getQueryClient } from '../query-client';
import { useCustomer } from '../session/customer-session';
import { addCartItem, clampQty, EMPTY_CART, removeCartItem, setCartItemQty, withItemQuantities, withLineQty } from './items';
import { cartQueryKeys } from './keys';

/**
 * The cart (SPEC §6.2–6.3). Prices always come from the API:
 *
 * - **Guests** keep `{ productId, variantId, qty }` lines in `localStorage` (`aricon_cart_v1`) and
 *   price them with `POST /api/cart/quote`.
 * - **Customers** have their cart on the server (`GET/PUT/DELETE /api/cart…`); after login the
 *   guest lines are merged into it (`mergeGuestCart()`).
 *
 * Quantity changes show at once (optimistic) while totals keep their last priced values until the
 * API answers, so the page never shows a price the browser computed.
 */

const AREA_STORAGE_KEY = 'aricon_area_v1';

interface CartContextValue {
  pricedCart: PricedCart;
  areaId: string | null;
  setAreaId: (areaId: string | null) => void;
  /** Adds to the line (or creates it). Rejects with the API's error (e.g. out of stock). */
  addItem: (item: CartItem) => Promise<void>;
  /** Sets a line's quantity (0 removes it); problems are shown as a toast. */
  setQty: (variantId: string, qty: number) => void;
  removeItem: (variantId: string) => void;
  /** After an order was placed: the server already emptied it, so just forget the cached copy. */
  clear: () => void;
  /** True once the first priced cart is available (avoids flashing an empty cart). */
  ready: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

interface StoredCart {
  items: CartItem[];
}

function isStoredCart(value: unknown): value is StoredCart {
  return typeof value === 'object' && value !== null && Array.isArray((value as { items?: unknown }).items);
}

const NO_ITEMS: CartItem[] = [];

/** SPEC §6.3: `aricon_cart_v1` = `{ items: [{ productId, variantId, qty }] }`. */
const guestItemsStore = createLocalStore<CartItem[]>({
  key: GUEST_CART_STORAGE_KEY,
  fallback: NO_ITEMS,
  parse: (raw) => {
    const parsed: unknown = JSON.parse(raw);
    return isStoredCart(parsed) ? parsed.items : null;
  },
  serialize: (items) => (items.length > 0 ? JSON.stringify({ items } satisfies StoredCart) : null),
});

/** The area chosen for delivery estimates (SPEC §6.4); checkout uses the address's own area. */
const areaStore = createLocalStore<string | null>({
  key: AREA_STORAGE_KEY,
  fallback: null,
  parse: (raw) => raw,
  serialize: (areaId) => areaId,
});

const withArea = (path: string, areaId: string | null) => (areaId ? `${path}?areaId=${encodeURIComponent(areaId)}` : path);

async function readCart(request: Promise<ApiResponse<PricedCart>>): Promise<PricedCart> {
  return (await request).data;
}

/** Saved lines the API can't read (e.g. from an older version of the site): drop them, don't retry forever. */
function isUnreadableGuestCart(error: unknown): boolean {
  return isApiError(error) && error.code === 'VALIDATION_ERROR';
}

async function quoteGuestCart(items: CartItem[], areaId: string | null, signal: AbortSignal): Promise<PricedCart> {
  try {
    return await readCart(
      apiClient<ApiResponse<PricedCart>>('/cart/quote', { method: 'POST', body: areaId ? { items, areaId } : { items }, signal }),
    );
  } catch (error) {
    if (!isUnreadableGuestCart(error)) throw error;
    guestItemsStore.set(NO_ITEMS);
    return EMPTY_CART;
  }
}

/**
 * After login or signup (SPEC §6.3): moves the guest's lines into the customer's cart (quantities
 * added, capped at stock by the API), then forgets them locally. Never throws: a failed merge only
 * leaves the guest lines where they were for the next attempt.
 */
export async function mergeGuestCart(): Promise<void> {
  const items = guestItemsStore.get();
  if (items.length > 0) {
    try {
      await apiClient('/cart/merge', { method: 'POST', body: { items } });
      guestItemsStore.set(NO_ITEMS);
    } catch (error) {
      if (!isUnreadableGuestCart(error)) return;
      guestItemsStore.set(NO_ITEMS);
    }
  }
  await getQueryClient().invalidateQueries({ queryKey: cartQueryKeys.all });
}

export function CartProvider({ children }: { children: ReactNode }) {
  const signedIn = useCustomer() !== null;
  const guestItems = useLocalStore(guestItemsStore);
  const areaId = useLocalStore(areaStore);
  const hydrated = useHydrated();
  const queryClient = useQueryClient();
  /** Per variant, the latest quantity request: older answers arriving late are ignored. */
  const latestRequest = useRef(new Map<string, number>());

  const quote = useQuery({
    queryKey: cartQueryKeys.quote(areaId, guestItems),
    queryFn: ({ signal }) => quoteGuestCart(guestItems, areaId, signal),
    enabled: hydrated && !signedIn && guestItems.length > 0,
    placeholderData: keepPreviousData,
  });

  const customerKey = cartQueryKeys.customer(areaId);
  const stored = useQuery({
    queryKey: customerKey,
    queryFn: ({ signal }) => readCart(apiClient<ApiResponse<PricedCart>>(withArea('/cart', areaId), { signal })),
    enabled: hydrated && signedIn,
    placeholderData: keepPreviousData,
  });

  const pricedCart = useMemo<PricedCart>(() => {
    if (signedIn) return stored.data ?? EMPTY_CART;
    if (guestItems.length === 0) return EMPTY_CART;
    return quote.data ? withItemQuantities(quote.data, guestItems) : EMPTY_CART;
  }, [signedIn, stored.data, guestItems, quote.data]);

  const ready =
    hydrated &&
    (signedIn
      ? stored.data !== undefined || stored.isError
      : guestItems.length === 0 || quote.data !== undefined || quote.isError);

  /** Sends one quantity change for a customer; only the newest answer per line updates the cart. */
  const sendCustomerQty = useCallback(
    async (variantId: string, qty: number) => {
      const sequence = (latestRequest.current.get(variantId) ?? 0) + 1;
      latestRequest.current.set(variantId, sequence);
      queryClient.setQueryData<PricedCart>(customerKey, (current) => (current ? withLineQty(current, variantId, qty) : current));
      const request =
        qty > 0
          ? apiClient<ApiResponse<PricedCart>>(withArea('/cart/items', areaId), { method: 'PUT', body: { variantId, qty } })
          : apiClient<ApiResponse<PricedCart>>(withArea(`/cart/items/${variantId}`, areaId), { method: 'DELETE' });
      try {
        const cart = await readCart(request);
        if (latestRequest.current.get(variantId) === sequence) queryClient.setQueryData(customerKey, cart);
      } catch (error) {
        await queryClient.invalidateQueries({ queryKey: cartQueryKeys.customerAll });
        throw error;
      }
    },
    [queryClient, customerKey, areaId],
  );

  const addItem = useCallback(
    async (item: CartItem) => {
      if (!signedIn) {
        guestItemsStore.set(addCartItem(guestItemsStore.get(), item));
        return;
      }
      const current = queryClient.getQueryData<PricedCart>(customerKey)?.lines.find((line) => line.variantId === item.variantId);
      await sendCustomerQty(item.variantId, clampQty((current?.qty ?? 0) + item.qty));
    },
    [signedIn, queryClient, customerKey, sendCustomerQty],
  );

  const setQty = useCallback(
    (variantId: string, qty: number) => {
      if (!signedIn) {
        guestItemsStore.set(setCartItemQty(guestItemsStore.get(), variantId, qty));
        return;
      }
      sendCustomerQty(variantId, qty > 0 ? clampQty(qty) : 0).catch((error: unknown) => {
        toast.error(errorMessage(error, "We couldn't update your cart. Please try again."));
      });
    },
    [signedIn, sendCustomerQty],
  );

  const removeItem = useCallback(
    (variantId: string) => {
      if (!signedIn) {
        guestItemsStore.set(removeCartItem(guestItemsStore.get(), variantId));
        return;
      }
      sendCustomerQty(variantId, 0).catch((error: unknown) => {
        toast.error(errorMessage(error, "We couldn't update your cart. Please try again."));
      });
    },
    [signedIn, sendCustomerQty],
  );

  const clear = useCallback(() => {
    if (!signedIn) guestItemsStore.set(NO_ITEMS);
    void queryClient.invalidateQueries({ queryKey: cartQueryKeys.all });
  }, [signedIn, queryClient]);

  const setAreaId = useCallback((next: string | null) => areaStore.set(next), []);

  const value = useMemo<CartContextValue>(
    () => ({ pricedCart, areaId, setAreaId, addItem, setQty, removeItem, clear, ready }),
    [pricedCart, areaId, setAreaId, addItem, setQty, removeItem, clear, ready],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart() must be used within <CartProvider>.');
  return context;
}
