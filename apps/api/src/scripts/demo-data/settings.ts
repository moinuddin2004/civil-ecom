import type { PageKey } from '@aricon/shared';

/** SPEC §5.14 / §19 demo settings — placeholders until Aricon provides the real values. */
export const STORE_SETTINGS = {
  storeName: 'Aricon Shop',
  phone: '+92 21 111 000 111',
  whatsapp: '+923001234567',
  email: 'shop@aricon.com.pk',
  address: 'Aricon Engineering Consultants, Shahrah-e-Faisal, Karachi',
  orderNotificationEmails: ['orders@aricon.com.pk'],
  rfpEmail: 'projects@aricon.com.pk',
  paymentMethods: { cod: true, bankTransfer: true },
  codMaxOrderAmount: 200_000,
  defaultDeliveryFee: 500,
  bankAccounts: [
    {
      id: 'bank-meezan',
      bankName: 'Meezan Bank',
      accountTitle: 'Aricon Engineering Consultants',
      accountNumber: '01234567890123',
      iban: 'PK36MEZN0001234567890123',
      raastId: '+923001234567',
    },
  ],
  bankTransferInstructions:
    'Transfer the exact order total to the account above, then upload a photo or screenshot of the receipt from your order page. We verify receipts within one business day.',
  lowStockDefault: 5,
} as const;

export const PAGE_CONTENT: Record<PageKey, string> = {
  about: `Aricon Engineering Consultants has supplied construction materials to homeowners and contractors across Karachi since 2005. Aricon Shop brings the same genuine brands and bulk pricing online, with our own riders delivering to your site.\n\nWe stock cement, tiles, plywood, paint, waterproofing, electrical, plumbing and hardware — all at prices that get better the more you buy.`,
  faq: `### How do I pay?\n\nCash on delivery or bank transfer. Online card payments are coming soon.\n\n### How fast is delivery?\n\nMost orders in our serviceable areas are delivered within 1–2 business days.\n\n### Can I return an item?\n\nContact us within 24 hours of delivery and we'll arrange a return for defective or wrong items.`,
  contact: `**Phone:** +92 21 111 000 111\n\n**WhatsApp:** +92 300 1234567\n\n**Email:** shop@aricon.com.pk\n\n**Address:** Aricon Engineering Consultants, Shahrah-e-Faisal, Karachi`,
  refundPolicy: `Items are eligible for return within 24 hours of delivery if they are defective, damaged in transit, or not what you ordered. Contact us with your order number and photos of the item; approved returns are picked up by our rider at no extra charge and refunded to your original payment method.`,
  deliveryPolicy: `We deliver with our own riders across the areas listed at checkout. Delivery charges depend on your area and are shown before you place your order. Most orders arrive within 1–2 business days; bulk orders may take a little longer.`,
  privacyPolicy: `We use your name, phone, address and order details only to deliver your order and provide support. We never sell your information. Contact us at shop@aricon.com.pk for any privacy questions.`,
  terms: `By placing an order you agree to pay the total shown at checkout, provide an accurate delivery address, and be available to receive cash-on-delivery orders. Prices and stock are confirmed at the time your order is placed.`,
};
