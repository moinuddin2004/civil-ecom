import { formatPKR, PAYMENT_METHOD_LABELS } from '@aricon/shared';
import type { NotificationEvent, NotificationPayloads } from './notification-events.js';

/** Store details every email shows in its footer (from settings at send time). */
export interface EmailStore {
  storeName: string;
  phone: string;
  email: string;
  address: string;
  appUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/* An email is a heading and a few blocks, rendered once as HTML and once as plain text. */
type Block =
  | { kind: 'p'; text: string }
  | { kind: 'rows'; rows: readonly (readonly [string, string])[] }
  | { kind: 'button'; label: string; url: string }
  | { kind: 'note'; text: string };

interface EmailContent {
  subject: string;
  heading: string;
  blocks: Block[];
}

const p = (text: string): Block => ({ kind: 'p', text });
const rows = (...list: (readonly [string, string])[]): Block => ({ kind: 'rows', rows: list });
const button = (label: string, url: string): Block => ({ kind: 'button', label, url });
const note = (text: string): Block => ({ kind: 'note', text });

function orderLines(items: NotificationPayloads['order.placed']['items']): Block {
  return rows(...items.map((item) => [`${item.productName} (${item.variantLabel}) × ${item.qty}`, formatPKR(item.lineTotal)] as const));
}

/** What each event says (SPEC §11). Plain words, the order number up front. */
const CONTENT: { [E in NotificationEvent]: (payload: NotificationPayloads[E], store: EmailStore) => EmailContent } = {
  'user.welcome': (x, store) => ({
    subject: `Welcome to ${store.storeName}`,
    heading: `Welcome, ${x.name}`,
    blocks: [
      p('Your account is ready. See bulk prices for your quantity, order with cash on delivery or bank transfer, and track every order in your account.'),
      button('Start shopping', x.shopUrl),
    ],
  }),
  'auth.password_reset': (x) => ({
    subject: 'Reset your password',
    heading: 'Reset your password',
    blocks: [
      p(`Hi ${x.name}, we got a request to reset your password. The link works for ${x.expiresInMinutes} minutes.`),
      button('Choose a new password', x.resetUrl),
      note("If you didn't ask for this, ignore this email; your password stays the same."),
    ],
  }),
  'order.placed': (x) => ({
    subject: `Order ${x.orderNumber} placed`,
    heading: 'Thanks, your order is placed',
    blocks: [
      p(`Hi ${x.name}, we got your order ${x.orderNumber}. We'll confirm it soon.`),
      orderLines(x.items),
      rows(
        ['Subtotal', formatPKR(x.subtotal)],
        ['Delivery', x.deliveryFee === 0 ? 'Free' : formatPKR(x.deliveryFee)],
        ['Total', formatPKR(x.total)],
        ['Payment', PAYMENT_METHOD_LABELS[x.paymentMethod]],
      ),
      ...(x.bankTransfer
        ? [
            p('Please transfer the total to one of these accounts, then upload your receipt from the order page.'),
            ...x.bankTransfer.accounts.map((account) =>
              rows(
                ['Bank', account.bankName],
                ['Account title', account.accountTitle],
                ['Account number', account.accountNumber],
                ...(account.iban ? [['IBAN', account.iban] as const] : []),
              ),
            ),
            ...(x.bankTransfer.instructions ? [note(x.bankTransfer.instructions)] : []),
            button('Upload receipt', x.orderUrl),
          ]
        : [p("Pay in cash when your order arrives. We'll call before delivery."), button('View order', x.orderUrl)]),
    ],
  }),
  'order.placed.staff': (x) => ({
    subject: `New order ${x.orderNumber} · ${formatPKR(x.total)}`,
    heading: `New order ${x.orderNumber}`,
    blocks: [
      rows(
        ['Customer', `${x.customerName} · ${x.customerPhone}`],
        ['Area', x.areaName],
        ['Total', formatPKR(x.total)],
        ['Payment', PAYMENT_METHOD_LABELS[x.paymentMethod]],
      ),
      button('Open in admin', x.adminUrl),
    ],
  }),
  'order.receipt_uploaded.staff': (x) => ({
    subject: `Receipt uploaded for ${x.orderNumber}`,
    heading: 'A bank receipt is waiting',
    blocks: [p(`The customer uploaded a payment receipt for order ${x.orderNumber}. Check it and approve or reject it.`), button('Review receipt', x.adminUrl)],
  }),
  'order.payment_received': (x) => ({
    subject: `Payment received for ${x.orderNumber}`,
    heading: 'Payment received',
    blocks: [p(`Hi ${x.name}, we checked your bank transfer for order ${x.orderNumber}. It's paid.`), button('View order', x.orderUrl)],
  }),
  'order.payment_rejected': (x) => ({
    subject: `Payment receipt not accepted for ${x.orderNumber}`,
    heading: "We couldn't accept your receipt",
    blocks: [
      p(`Hi ${x.name}, we couldn't match the receipt you uploaded for order ${x.orderNumber}.`),
      rows(['Reason', x.reason]),
      p('Please upload a clear receipt of the transfer.'),
      button('Upload again', x.uploadUrl),
    ],
  }),
  'order.confirmed': (x) => ({
    subject: `Order ${x.orderNumber} confirmed`,
    heading: 'Your order is confirmed',
    blocks: [p(`Hi ${x.name}, we confirmed order ${x.orderNumber} and are getting it ready.`), button('View order', x.orderUrl)],
  }),
  'order.dispatched': (x) => ({
    subject: `Order ${x.orderNumber} is on the way`,
    heading: 'Your order is on the way',
    blocks: [
      p(`Hi ${x.name}, order ${x.orderNumber} has left our warehouse.`),
      rows(['Rider', x.riderName], ['Rider phone', x.riderPhone]),
      button('View order', x.orderUrl),
    ],
  }),
  'order.delivered': (x) => ({
    subject: `Order ${x.orderNumber} delivered`,
    heading: 'Your order was delivered',
    blocks: [p(`Hi ${x.name}, order ${x.orderNumber} was delivered. Thank you for ordering with us.`), button('Download invoice', x.invoiceUrl)],
  }),
  'order.cancelled': (x) => ({
    subject: `Order ${x.orderNumber} cancelled`,
    heading: 'Your order was cancelled',
    blocks: [p(`Hi ${x.name}, order ${x.orderNumber} was cancelled.`), rows(['Reason', x.reason]), button('View order', x.orderUrl)],
  }),
  'rfp.inquiry': (x) => ({
    subject: `Project inquiry from ${x.company}`,
    heading: 'New project inquiry',
    blocks: [
      rows(
        ['Company', x.company],
        ['Contact person', x.contactPerson],
        ['Email', x.email],
        ['Phone', x.phone ?? '—'],
        ['Location', x.location ?? '—'],
        ['Service', x.service],
      ),
      note(x.brief),
      p('Reply to this email to answer the inquirer directly.'),
    ],
  }),
};

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Only http(s) links become buttons; anything else would be a trap in an email. */
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : '#';
}

const FONT = "font-family:Arial,Helvetica,sans-serif";

function blockHtml(block: Block): string {
  switch (block.kind) {
    case 'p':
      return `<p style="${FONT};font-size:15px;line-height:22px;color:#1E2A33;margin:0 0 16px">${escapeHtml(block.text)}</p>`;
    case 'note':
      return `<p style="${FONT};font-size:14px;line-height:20px;color:#47535C;background:#F3F4F6;border-radius:8px;padding:12px 14px;margin:0 0 16px;white-space:pre-line">${escapeHtml(block.text)}</p>`;
    case 'rows':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse">${block.rows
        .map(
          ([label, value]) =>
            `<tr><td style="${FONT};font-size:14px;color:#6B7680;padding:6px 12px 6px 0;border-bottom:1px solid #E4E7EA">${escapeHtml(label)}</td><td style="${FONT};font-size:14px;color:#1E2A33;padding:6px 0;border-bottom:1px solid #E4E7EA;text-align:right">${escapeHtml(value)}</td></tr>`,
        )
        .join('')}</table>`;
    case 'button':
      return `<p style="margin:8px 0 20px"><a href="${escapeHtml(safeUrl(block.url))}" style="${FONT};display:inline-block;background:#F2A900;color:#1E2A33;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">${escapeHtml(block.label)}</a></p>`;
  }
}

function blockText(block: Block): string {
  switch (block.kind) {
    case 'p':
    case 'note':
      return block.text;
    case 'rows':
      return block.rows.map(([label, value]) => `${label}: ${value}`).join('\n');
    case 'button':
      return `${block.label}: ${block.url}`;
  }
}

/** Renders one notification as a branded HTML email plus its plain-text twin (SPEC §11). */
export function renderEmail<E extends NotificationEvent>(event: E, payload: NotificationPayloads[E], store: EmailStore): RenderedEmail {
  const content = CONTENT[event](payload, store);
  const footer = [store.storeName, store.address, [store.phone, store.email].filter(Boolean).join(' · ')].filter(Boolean);

  const html = `<!doctype html><html><body style="margin:0;background:#F3F4F6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="background:#1E2A33;border-radius:16px 16px 0 0;padding:18px 24px"><a href="${escapeHtml(safeUrl(store.appUrl))}" style="${FONT};font-size:20px;font-weight:bold;letter-spacing:2px;color:#FFFFFF;text-decoration:none">ARICON <span style="font-weight:normal;letter-spacing:0;color:#C9CFD4">Shop</span></a></td></tr>
<tr><td style="background:#FFFFFF;border-radius:0 0 16px 16px;padding:24px">
<h1 style="${FONT};font-size:22px;line-height:28px;color:#1E2A33;margin:0 0 16px">${escapeHtml(content.heading)}</h1>
${content.blocks.map(blockHtml).join('\n')}
</td></tr>
<tr><td style="${FONT};font-size:12px;line-height:18px;color:#6B7680;padding:16px 24px;text-align:center">${footer.map(escapeHtml).join('<br>')}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [content.heading, '', ...content.blocks.map(blockText).flatMap((part) => [part, '']), '—', ...footer].join('\n');
  return { subject: content.subject, html, text };
}

