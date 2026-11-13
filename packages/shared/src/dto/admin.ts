import type {
  ActorType,
  AuditAction,
  AuditEntity,
  CatalogStatus,
  ImportJobStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  Role,
  StaffRole,
  StockMovementReason,
  Unit,
  UserStatus,
} from '../enums.js';
import type { Permission } from '../permissions.js';
import type { BulkTier } from '../pricing.js';
import type { OrderItemDTO, ReceiptDTO, ShippingAddressDTO } from './customer.js';

/** Admin API responses (SPEC §7.3). Dates are ISO strings. */

export interface AdminUserDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  status: UserStatus;
  lastLoginAt: string | null;
}

/** `GET /api/admin/auth/me`. */
export interface AdminMeDTO {
  user: AdminUserDTO;
  /** Effective permissions (all of them for ADMIN). */
  permissions: Permission[];
  mustChangePassword: boolean;
}

/** `GET /api/admin/staff` row; `permissions` is the stored list. */
export interface StaffDTO extends AdminUserDTO {
  permissions: Permission[];
  mustChangePassword: boolean;
  createdAt: string;
}

/** Returned once by staff create and password reset; never stored in plain text. */
export interface TemporaryPasswordDTO {
  staff: StaffDTO;
  temporaryPassword: string;
}

export interface PermissionCatalogDTO {
  groups: {
    group: string;
    permissions: { key: Permission; label: string; dependsOn: Permission[]; sensitive: boolean }[];
  }[];
  presets: { key: string; label: string; permissions: Permission[] }[];
  defaultStaffPermissions: Permission[];
}

export interface AdminOrderListItemDTO {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  areaName: string;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  riderId: string | null;
  riderName: string | null;
  /** Cash recorded for a COD order; null until then. Compare with `total` for a short/extra amount. */
  codCollectedAmount: number | null;
}

export interface AdminStatusHistoryEntryDTO {
  status: OrderStatus;
  at: string;
  byType: ActorType;
  byUserName: string | null;
  note: string | null;
}

export interface AdminReceiptDTO extends ReceiptDTO {
  reviewedByName: string | null;
}

/** `GET /api/admin/orders/:id/receipts/:receiptId/url`: a private file link that expires (SPEC §6.8). */
export interface FileLinkDTO {
  url: string;
  /** ISO date-time; the link stops working after this. */
  expiresAt: string;
}

/** One sellable variant staff can add to an order they create (`GET /api/admin/orders/product-options`). */
export interface AdminOrderProductOptionDTO {
  productId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  /** Current single-unit price; the server re-prices the order (bulk tiers included). */
  price: number;
  stock: number;
}

export interface AdminOrderDTO {
  id: string;
  orderNumber: string;
  trackingCode: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  customer: { name: string; email: string; phone: string };
  shippingAddress: ShippingAddressDTO;
  deliveryAreaId: string;
  items: OrderItemDTO[];
  subtotal: number;
  deliveryFee: number;
  /** Staff discount on the subtotal (0 when none). `total = subtotal - discount + deliveryFee`. */
  discount: number;
  discountReason: string | null;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  receipts: AdminReceiptDTO[];
  status: OrderStatus;
  statusHistory: AdminStatusHistoryEntryDTO[];
  riderId: string | null;
  rider: { name: string; phone: string } | null;
  codCollected: { amount: number; at: string; byName: string | null; note: string | null } | null;
  customerNote: string | null;
  internalNote: string | null;
  cancelReason: string | null;
}

export interface AdminVariantDTO {
  id: string;
  sku: string;
  label: string;
  options: { packSize?: string; grade?: string; colour?: string; size?: string };
  mrp: number;
  price: number;
  bulkTiers: BulkTier[];
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
  isLowStock: boolean;
}

export interface AdminProductListItemDTO {
  id: string;
  slug: string;
  name: string;
  imageKey: string | null;
  brandName: string;
  categoryName: string;
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  hasLowStock: boolean;
  status: ProductStatus;
  updatedAt: string;
}

export interface AdminProductDTO {
  id: string;
  slug: string;
  name: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  type: string | null;
  unit: Unit;
  description: string;
  specifications: { label: string; value: string }[];
  images: { id: string; key: string; alt: string }[];
  variants: AdminVariantDTO[];
  isFeatured: boolean;
  relatedProductIds: string[];
  seo: { title: string | null; description: string | null };
  status: ProductStatus;
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCategoryDTO {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  imageKey: string | null;
  sortOrder: number;
  showOnHome: boolean;
  status: CatalogStatus;
  productCount: number;
}

export interface AdminBrandDTO {
  id: string;
  name: string;
  slug: string;
  logoKey: string | null;
  sortOrder: number;
  status: CatalogStatus;
  productCount: number;
}

export interface AdminDeliveryAreaDTO {
  id: string;
  name: string;
  city: string;
  isServiceable: boolean;
  /** null = uses the default fee. */
  deliveryFee: number | null;
  freeDeliveryAbove: number | null;
  sortOrder: number;
}

export interface RiderDTO {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
}

export interface AdminCustomerListItemDTO {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string | null;
  orderCount: number;
  /** Excludes cancelled and returned orders. */
  totalSpent: number;
  status: UserStatus;
  createdAt: string;
}

export interface AdminCustomerDetailDTO extends AdminCustomerListItemDTO {
  addresses: {
    id: string;
    label: string;
    contactName: string;
    phone: string;
    line1: string;
    line2: string | null;
    landmark: string | null;
    areaName: string | null;
    city: string;
    isDefault: boolean;
  }[];
  recentOrders: AdminOrderListItemDTO[];
  lastLoginAt: string | null;
}

export interface StockMovementDTO {
  id: string;
  at: string;
  productId: string;
  productName: string | null;
  variantId: string;
  sku: string;
  change: number;
  stockAfter: number;
  reason: StockMovementReason;
  refType: 'order' | 'import' | null;
  refId: string | null;
  /** Order number when `refType` is "order". */
  refLabel: string | null;
  note: string | null;
  byUserName: string | null;
}

export interface AuditLogDTO {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
}

export interface ImportJobDTO {
  id: string;
  status: ImportJobStatus;
  totalRows: number;
  processedRows: number;
  summary: { created: number; updated: number; failed: number };
  errors: { row: number; sku: string | null; message: string }[];
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/** `GET /api/admin/dashboard`: only the widgets the user may see are present. */
export interface DashboardDTO {
  sales?: {
    today: { orders: number; revenue: number };
    last7Days: { orders: number; revenue: number };
    last30Days: { orders: number; revenue: number };
    /** Daily revenue for the last 30 days (Karachi dates). */
    series: { date: string; orders: number; revenue: number }[];
  };
  ordersByStatus?: Record<OrderStatus, number>;
  receiptsToVerify?: { count: number; orders: AdminOrderListItemDTO[] };
  codToCollect?: { count: number; amount: number };
  lowStock?: {
    count: number;
    items: { productId: string; productName: string; variantId: string; sku: string; variantLabel: string; stock: number; threshold: number }[];
  };
}

export interface SalesReportDTO {
  from: string;
  to: string;
  groupBy: 'day' | 'month';
  totals: {
    orders: number;
    /** Sum of order totals (after discounts, delivery included); cancelled and returned orders left out. */
    revenue: number;
    averageOrder: number;
    /** Revenue before discounts and delivery fees. */
    subtotal: number;
    discounts: number;
    deliveryFees: number;
    /** Money actually received: bank transfers once approved, COD as recorded (a short amount counts as received). */
    collected: number;
    /** Revenue of orders whose payment hasn't been received yet. */
    pending: number;
  };
  series: { period: string; orders: number; revenue: number; collected: number }[];
  /** Per payment method: what was sold and what has come in. */
  byPayment: { method: PaymentMethod; orders: number; revenue: number; collected: number; pending: number }[];
}

export interface TopProductsReportDTO {
  from: string;
  to: string;
  byQuantity: { productId: string; productName: string; sku: string; qty: number; revenue: number }[];
  byRevenue: { productId: string; productName: string; sku: string; qty: number; revenue: number }[];
}

export interface CodReportDTO {
  from: string;
  to: string;
  totals: {
    collected: number;
    pending: number;
    collectedOrders: number;
    pendingOrders: number;
    /** Order totals of the orders whose cash is recorded (what should have come in). */
    expected: number;
    /** Sum of what was collected below the order total. */
    short: number;
    /** Sum of what was collected above the order total. */
    extra: number;
  };
  byRider: { riderId: string | null; riderName: string; collected: number; pending: number; expected: number; short: number; extra: number }[];
  byDay: { date: string; collected: number; pending: number; expected: number; short: number; extra: number }[];
  /** Orders where the cash collected differs from the total, biggest shortfall first (at most 100). */
  differences: {
    orderId: string;
    orderNumber: string;
    riderName: string | null;
    date: string;
    total: number;
    collected: number;
    /** `collected - total`: negative is short. */
    difference: number;
    note: string | null;
  }[];
}

export interface AdminSettingsDTO {
  storeName: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  orderNotificationEmails: string[];
  rfpEmail: string;
  paymentMethods: { cod: boolean; bankTransfer: boolean };
  codMaxOrderAmount: number | null;
  defaultDeliveryFee: number;
  bankAccounts: { id: string; bankName: string; accountTitle: string; accountNumber: string; iban: string | null; raastId: string | null }[];
  bankTransferInstructions: string;
  lowStockDefault: number;
  pages: Record<'about' | 'faq' | 'contact' | 'refundPolicy' | 'deliveryPolicy' | 'privacyPolicy' | 'terms', string>;
  /** null until an admin first saves the settings (defaults are shown until then). */
  updatedAt: string | null;
}

export interface AdminHomepageDTO {
  banners: {
    id: string;
    desktopKey: string;
    mobileKey: string | null;
    alt: string;
    link: string | null;
    isActive: boolean;
    sortOrder: number;
  }[];
  featuredProducts: { id: string; name: string; imageKey: string | null; status: ProductStatus }[];
  dealProducts: { id: string; name: string; imageKey: string | null; status: ProductStatus }[];
}

/** Upload endpoints return the stored key plus the id it was stored under. */
export interface UploadResultDTO {
  key: string;
  /** Owner id (product, banner, category or brand) used in the key. */
  ownerId: string;
}
