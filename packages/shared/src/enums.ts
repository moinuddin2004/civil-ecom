/**
 * Enumerations shared by the API, the web app and the seed scripts (SPEC §5).
 * Each list is the single source of truth for its values; labels are the UI wording.
 */

export const ROLES = ['ADMIN', 'STAFF', 'CUSTOMER'] as const;
export type Role = (typeof ROLES)[number];

/** Roles that sign in at /admin. */
export const STAFF_ROLES = ['ADMIN', 'STAFF'] as const satisfies readonly Role[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  STAFF: 'Staff',
  CUSTOMER: 'Customer',
};

export const USER_STATUSES = ['active', 'blocked'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * What one quantity means. SPEC §5.6 lists bag … set; `coil`, `length`, `gallon` and `pail` come
 * from the approved v2 mockups (wires, pipes, paint, waterproofing).
 */
export const UNITS = [
  'bag',
  'piece',
  'sheet',
  'litre',
  'box',
  'roll',
  'metre',
  'sqft',
  'kg',
  'set',
  'coil',
  'length',
  'gallon',
  'pail',
] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_LABELS: Record<Unit, { one: string; many: string }> = {
  bag: { one: 'bag', many: 'bags' },
  piece: { one: 'piece', many: 'pieces' },
  sheet: { one: 'sheet', many: 'sheets' },
  litre: { one: 'litre', many: 'litres' },
  box: { one: 'box', many: 'boxes' },
  roll: { one: 'roll', many: 'rolls' },
  metre: { one: 'metre', many: 'metres' },
  sqft: { one: 'sq ft', many: 'sq ft' },
  kg: { one: 'kg', many: 'kg' },
  set: { one: 'set', many: 'sets' },
  coil: { one: 'coil', many: 'coils' },
  length: { one: 'length', many: 'lengths' },
  gallon: { one: 'gallon', many: 'gallons' },
  pail: { one: 'pail', many: 'pails' },
};

export const CATALOG_STATUSES = ['active', 'hidden'] as const;
export type CatalogStatus = (typeof CATALOG_STATUSES)[number];

export const PRODUCT_STATUSES = ['active', 'hidden', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  active: 'Active',
  hidden: 'Hidden',
  archived: 'Archived',
};

/** Variant option keys (SPEC §5.6 `options`). */
export const VARIANT_OPTION_KEYS = ['packSize', 'grade', 'colour', 'size'] as const;
export type VariantOptionKey = (typeof VARIANT_OPTION_KEYS)[number];

export const VARIANT_OPTION_LABELS: Record<VariantOptionKey, string> = {
  packSize: 'Pack size',
  grade: 'Grade',
  colour: 'Colour',
  size: 'Size',
};

/** Storefront filter keys: product `type` plus the variant options (SPEC §5.6 `filters`). */
export const FILTER_KEYS = ['type', 'packSize', 'grade', 'colour', 'size'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export const FILTER_LABELS: Record<FilterKey, string> = {
  type: 'Type',
  ...VARIANT_OPTION_LABELS,
};

export const ORDER_STATUSES = [
  'NEW',
  'CONFIRMED',
  'DISPATCHED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'New',
  CONFIRMED: 'Confirmed',
  DISPATCHED: 'On the way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

export const PAYMENT_METHODS = ['COD', 'BANK_TRANSFER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  COD: 'Cash on delivery',
  BANK_TRANSFER: 'Bank transfer',
};

export const PAYMENT_STATUSES = [
  'PENDING',
  'AWAITING_VERIFICATION',
  'PAID',
  'REJECTED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Pending',
  AWAITING_VERIFICATION: 'Awaiting verification',
  PAID: 'Paid',
  REJECTED: 'Rejected',
  REFUNDED: 'Refunded',
};

export const RECEIPT_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

/** Who caused an order status change (SPEC §5.10 `statusHistory.byType`). */
export const ACTOR_TYPES = ['customer', 'staff', 'system'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const STOCK_MOVEMENT_REASONS = ['ORDER', 'CANCEL', 'RETURN', 'ADJUST', 'IMPORT'] as const;
export type StockMovementReason = (typeof STOCK_MOVEMENT_REASONS)[number];

export const STOCK_MOVEMENT_REASON_LABELS: Record<StockMovementReason, string> = {
  ORDER: 'Order',
  CANCEL: 'Cancelled order',
  RETURN: 'Returned order',
  ADJUST: 'Manual adjustment',
  IMPORT: 'Excel import',
};

export const IMPORT_JOB_STATUSES = ['QUEUED', 'RUNNING', 'DONE', 'FAILED'] as const;
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number];

export const AUDIT_ENTITIES = [
  'product',
  'order',
  'user',
  'settings',
  'deliveryArea',
  'rider',
  'category',
  'brand',
  'homepage',
  'importJob',
] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

/** Audit actions (SPEC §5.16 plus the other admin writes CLAUDE.md requires to be logged). */
export const AUDIT_ACTIONS = [
  'product.created',
  'product.updated',
  'product.price_changed',
  'product.status_changed',
  'product.variant_added',
  'stock.adjusted',
  'products.imported',
  'order.created',
  'order.status_changed',
  'order.rider_assigned',
  'order.cod_collected',
  'order.payment_approved',
  'order.payment_rejected',
  'order.internal_note_changed',
  'user.created',
  'user.updated',
  'user.role_changed',
  'user.permissions_changed',
  'user.blocked',
  'user.unblocked',
  'user.password_reset',
  'settings.updated',
  'deliveryArea.created',
  'deliveryArea.updated',
  'rider.created',
  'rider.updated',
  'category.created',
  'category.updated',
  'brand.created',
  'brand.updated',
  'homepage.updated',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Content pages stored in settings (SPEC §5.14 `pages`) and their URL keys (SPEC §7.2 `/api/pages/:key`).
 */
export const PAGE_KEYS = [
  'about',
  'faq',
  'contact',
  'refundPolicy',
  'deliveryPolicy',
  'privacyPolicy',
  'terms',
] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

export const PAGE_SLUGS: Record<PageKey, string> = {
  about: 'about',
  faq: 'faq',
  contact: 'contact',
  refundPolicy: 'refund-policy',
  deliveryPolicy: 'delivery-policy',
  privacyPolicy: 'privacy-policy',
  terms: 'terms',
};

export const PAGE_TITLES: Record<PageKey, string> = {
  about: 'About Aricon Shop',
  faq: 'Frequently asked questions',
  contact: 'Contact us',
  refundPolicy: 'Refund policy',
  deliveryPolicy: 'Delivery policy',
  privacyPolicy: 'Privacy policy',
  terms: 'Terms and conditions',
};

export function pageKeyFromSlug(slug: string): PageKey | null {
  const entry = Object.entries(PAGE_SLUGS).find(([, value]) => value === slug);
  return entry ? (entry[0] as PageKey) : null;
}

/** Storefront sort options for product lists (SPEC §7.2). */
export const PRODUCT_SORTS = ['relevance', 'price_asc', 'price_desc', 'newest'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  relevance: 'Relevance',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  newest: 'Newest',
};
