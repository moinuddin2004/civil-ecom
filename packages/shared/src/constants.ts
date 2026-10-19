/** Limits and fixed values from the spec, in one place so API and UI agree. */

export const TIMEZONE = 'Asia/Karachi';
export const DEFAULT_CITY = 'Karachi';

/** Quantity per cart line (SPEC §6.2). */
export const QTY_MIN = 1;
export const QTY_MAX = 9_999;

export const CART_MAX_LINES = 50;
export const MAX_ADDRESSES = 10;
export const MAX_BULK_TIERS = 5;
export const MIN_TIER_QTY = 2;
export const MAX_PRODUCT_IMAGES = 10;
export const MAX_SPECIFICATIONS = 40;
export const MAX_RELATED_PRODUCTS = 8;
export const MAX_DESCRIPTION_LENGTH = 20_000;
export const MAX_BANNERS = 8;
export const MAX_HOMEPAGE_PRODUCTS = 12;
export const NEW_ARRIVALS_COUNT = 12;
export const MAX_PENDING_RECEIPTS = 3;
export const CUSTOMER_NOTE_MAX = 500;
export const INTERNAL_NOTE_MAX = 2_000;
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

/** Passwords: 8–72 characters (bcrypt reads at most 72 bytes), at least one letter and one number. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

/** Account lockout (SPEC §6.11). */
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
export const PASSWORD_RESET_TTL_MINUTES = 60;

/** Search suggestions (SPEC §7.2). */
export const SUGGEST_MIN_QUERY = 2;
export const SUGGEST_PRODUCTS = 6;
export const SUGGEST_CATEGORIES = 3;
export const SUGGEST_BRANDS = 3;

/** Upload limits in bytes (SPEC §12.2). */
export const MB = 1024 * 1024;
export const IMAGE_UPLOAD_MAX_BYTES = 8 * MB;
export const RECEIPT_UPLOAD_MAX_BYTES = 5 * MB;
export const IMPORT_UPLOAD_MAX_BYTES = 5 * MB;

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const RECEIPT_MIME_TYPES = [...IMAGE_MIME_TYPES, 'application/pdf'] as const;

/** Presigned receipt URLs live for 10 minutes (SPEC §6.8). */
export const RECEIPT_URL_TTL_SECONDS = 600;

/** Guest cart in localStorage (SPEC §6.3). */
export const GUEST_CART_STORAGE_KEY = 'aricon_cart_v1';
/** Cookie remembering the chosen delivery area for estimates (SPEC §6.4). */
export const AREA_COOKIE = 'aricon_area';

/**
 * Auth cookies (JWT; see PROGRESS.md "Backend decisions"). Customers and staff have separate
 * cookies signed with separate keys, so a customer token never reaches the admin API.
 * - `access`: short-lived JWT, sent with every request.
 * - `refresh`: opaque rotating token (stored hashed by the API), used only to get a new access token.
 */
export const AUTH_COOKIES = {
  customer: { access: 'aricon_at', refresh: 'aricon_rt' },
  admin: { access: 'aricon_admin_at', refresh: 'aricon_admin_rt' },
} as const;

/** Present while a customer is signed in (the refresh cookie outlives the access cookie). */
export const CUSTOMER_SESSION_COOKIE = AUTH_COOKIES.customer.refresh;
/** Present while a staff member is signed in. */
export const ADMIN_SESSION_COOKIE = AUTH_COOKIES.admin.refresh;

/** Header carrying the checkout idempotency key (SPEC §6.6). */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/** Next.js ISR window for catalog pages, seconds (CLAUDE.md "Server constraints"). */
export const CATALOG_REVALIDATE_SECONDS = 300;

/**
 * Next.js data-cache tags (SPEC §14): the web app tags its catalog fetches with these, and the API
 * sends the same strings to `POST /_internal/revalidate` after a change.
 */
export const CACHE_TAGS = {
  catalog: 'catalog',
  home: 'home',
  pages: 'pages',
  settings: 'settings',
  deliveryAreas: 'delivery-areas',
  product: (slug: string) => `product:${slug}`,
  category: (slug: string) => `category:${slug}`,
  brand: (slug: string) => `brand:${slug}`,
} as const;
