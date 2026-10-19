import { describe, expect, it } from 'vitest';
import { renderEmail, type EmailStore } from './email-templates.js';

const store: EmailStore = {
  storeName: 'Aricon Shop',
  phone: '+92 21 111 000 111',
  email: 'orders@aricon.com.pk',
  address: 'Karachi',
  appUrl: 'https://shop.aricon.com.pk',
};

describe('renderEmail', () => {
  it('renders an order email in HTML and plain text with the order details', () => {
    const email = renderEmail(
      'order.placed',
      {
        to: 'ahmed@example.com',
        name: 'Ahmed',
        orderNumber: 'ARC-2026-000123',
        orderUrl: 'https://shop.aricon.com.pk/account/orders/ARC-2026-000123',
        items: [{ productName: 'Lucky Cement OPC', variantLabel: '50 kg bag', qty: 40, unitPrice: 1_490, lineTotal: 59_600 }],
        subtotal: 59_600,
        deliveryFee: 0,
        total: 59_600,
        paymentMethod: 'BANK_TRANSFER',
        bankTransfer: {
          accounts: [{ bankName: 'Meezan Bank', accountTitle: 'Aricon', accountNumber: '0101-0123456', iban: null }],
          instructions: 'Send the receipt within 24 hours.',
        },
      },
      store,
    );
    expect(email.subject).toBe('Order ARC-2026-000123 placed');
    for (const part of [email.html, email.text]) {
      expect(part).toContain('ARC-2026-000123');
      expect(part).toContain('Rs 59,600');
      expect(part).toContain('Meezan Bank');
      expect(part).toContain('Upload receipt');
    }
    expect(email.text).toContain('Upload receipt: https://shop.aricon.com.pk/account/orders/ARC-2026-000123');
  });

  it('escapes whatever people typed and never links to non-web URLs', () => {
    const email = renderEmail(
      'rfp.inquiry',
      {
        to: 'sales@aricon.com.pk',
        replyTo: 'x@example.com',
        company: '<script>alert(1)</script>',
        contactPerson: 'A & B',
        email: 'x@example.com',
        phone: null,
        location: null,
        service: 'Waterproofing',
        brief: '"Roof" leaks',
      },
      store,
    );
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).toContain('A &amp; B');

    const reset = renderEmail('auth.password_reset', { to: 'a@b.co', name: 'A', resetUrl: 'javascript:alert(1)', expiresInMinutes: 60 }, store);
    expect(reset.html).not.toContain('javascript:');
  });
});
