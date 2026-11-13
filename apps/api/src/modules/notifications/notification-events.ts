import type { PaymentMethod } from '@aricon/shared';

/** One order line as emails show it. */
export interface EmailOrderLine {
  productName: string;
  variantLabel: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

/** Email events (SPEC §11) and what each email needs. The list grows with each feature. */
export interface NotificationPayloads {
  'user.welcome': { to: string; name: string; shopUrl: string };
  'auth.password_reset': { to: string; name: string; resetUrl: string; expiresInMinutes: number };
  'order.placed': {
    to: string;
    name: string;
    orderNumber: string;
    /** 6-digit code to track the order without signing in (SPEC §6.6b). */
    trackingCode?: string | null;
    orderUrl: string;
    items: EmailOrderLine[];
    subtotal: number;
    /** Staff discount on the subtotal; 0 (or missing) when none. */
    discount?: number;
    deliveryFee: number;
    total: number;
    paymentMethod: PaymentMethod;
    /** Bank transfer only: where to pay and how. */
    bankTransfer: { accounts: { bankName: string; accountTitle: string; accountNumber: string; iban: string | null }[]; instructions: string } | null;
  };
  'order.placed.staff': {
    to: string[];
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    areaName: string;
    total: number;
    paymentMethod: PaymentMethod;
    adminUrl: string;
  };
  'order.cancelled': { to: string; name: string; orderNumber: string; reason: string; orderUrl: string };
  'order.confirmed': { to: string; name: string; orderNumber: string; orderUrl: string };
  'order.dispatched': { to: string; name: string; orderNumber: string; orderUrl: string; riderName: string; riderPhone: string };
  'order.delivered': { to: string; name: string; orderNumber: string; orderUrl: string; invoiceUrl: string };
  'order.payment_received': { to: string; name: string; orderNumber: string; orderUrl: string };
  'order.payment_rejected': { to: string; name: string; orderNumber: string; reason: string; uploadUrl: string };
  'order.receipt_uploaded.staff': { to: string[]; orderNumber: string; adminUrl: string };
  'rfp.inquiry': {
    to: string;
    /** Replies go straight to the person who asked. */
    replyTo: string;
    company: string;
    contactPerson: string;
    email: string;
    phone: string | null;
    location: string | null;
    service: string;
    brief: string;
  };
}

export type NotificationEvent = keyof NotificationPayloads;
