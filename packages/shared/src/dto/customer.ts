import type { PricedCart } from '../cart.js';
import type {
  ActorType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ReceiptStatus,
  Unit,
} from '../enums.js';

/** Customer auth, account and order responses (SPEC §7.2). Dates are ISO strings. */

export interface CustomerDTO {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string | null;
  role: 'CUSTOMER';
}

export interface AddressDTO {
  id: string;
  label: string;
  contactName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  areaId: string;
  areaName: string | null;
  /** False when the area no longer delivers (checkout blocks it). */
  areaServiceable: boolean;
  city: string;
  isDefault: boolean;
}

export interface OrderItemDTO {
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
  /** Current slug for linking, when the product still exists. */
  productSlug: string | null;
  variantLabel: string;
  brandName: string;
  unit: Unit;
  imageKey: string | null;
  qty: number;
  mrp: number;
  basePrice: number;
  unitPrice: number;
  appliedTierMinQty: number | null;
  lineTotal: number;
}

export interface ShippingAddressDTO {
  label: string;
  contactName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  areaId: string;
  areaName: string;
  city: string;
}

export interface ReceiptDTO {
  id: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  status: ReceiptStatus;
  rejectReason: string | null;
  reviewedAt: string | null;
}

export interface StatusHistoryEntryDTO {
  status: OrderStatus;
  at: string;
  byType: ActorType;
  note: string | null;
}

/** `GET /api/orders/:orderNumber` (own orders only). */
export interface CustomerOrderDTO {
  id: string;
  orderNumber: string;
  /** 6 digits, for public tracking. Null only for orders from before tracking codes existed. */
  trackingCode: string | null;
  createdAt: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  items: OrderItemDTO[];
  subtotal: number;
  deliveryFee: number;
  /** Discount given by staff (0 when none). */
  discount: number;
  total: number;
  shippingAddress: ShippingAddressDTO;
  receipts: ReceiptDTO[];
  statusHistory: StatusHistoryEntryDTO[];
  /** Shown once the order is dispatched. */
  rider: { name: string; phone: string } | null;
  customerNote: string | null;
  cancelReason: string | null;
  canCancel: boolean;
  canUploadReceipt: boolean;
}

/**
 * `POST /api/public/track-order`: just enough to follow an order. No address, items, prices,
 * customer name or phone (the order number and phone are the only proof of ownership).
 */
export interface OrderTrackingDTO {
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  /** Every status the order has been in, oldest first. */
  history: { status: OrderStatus; at: string }[];
  /** Name only (no phone), shown once the order is dispatched or delivered. */
  riderName: string | null;
}

/** Row in `GET /api/orders`. */
export interface CustomerOrderListItemDTO {
  id: string;
  orderNumber: string;
  trackingCode: string | null;
  createdAt: string;
  itemCount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
}

/** `POST /api/orders/:orderNumber/reorder` (SPEC §7.2: "returns cart + skipped items"). */
export interface ReorderResultDTO {
  /** The customer's cart after the available items were added. */
  cart: PricedCart;
  /** Lines that couldn't be added, with the reason. */
  skipped: { productName: string; variantLabel: string; reason: string }[];
}
