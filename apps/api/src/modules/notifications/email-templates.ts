import { formatPKR, PAYMENT_METHOD_LABELS } from '@aricon/shared';
import type {
  NotificationEvent,
  NotificationPayloads,
} from './notification-events.js';

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

type Tone = 'blue' | 'pink' | 'lav';
type EmailRows = readonly (readonly [string, string])[];
type OrderItem = NotificationPayloads['order.placed']['items'][number];

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'title'; text: string }
  | { kind: 'rows'; rows: EmailRows }
  | { kind: 'summary'; rows: EmailRows }
  | { kind: 'products'; items: readonly OrderItem[] }
  | { kind: 'button'; label: string; url: string; tone?: Tone }
  | { kind: 'note'; text: string; title?: string; tone?: Tone }
  | { kind: 'code'; label: string; value: string };

interface EmailContent {
  subject: string;
  kicker: string;
  heading: string;
  brandSub?: string;
  reference?: string;
  blocks: Block[];
}

const p = (text: string): Block => ({ kind: 'p', text });
const sectionTitle = (text: string): Block => ({ kind: 'title', text });
const rows = (...list: (readonly [string, string])[]): Block => ({
  kind: 'rows',
  rows: list,
});
const summary = (...list: (readonly [string, string])[]): Block => ({
  kind: 'summary',
  rows: list,
});
const products = (items: readonly OrderItem[]): Block => ({
  kind: 'products',
  items,
});
const button = (label: string, url: string, tone?: Tone): Block => ({
  kind: 'button',
  label,
  url,
  tone,
});
const note = (text: string, tone?: Tone, title?: string): Block => ({
  kind: 'note',
  text,
  tone,
  title,
});
const code = (label: string, value: string): Block => ({
  kind: 'code',
  label,
  value,
});

/** Event-specific content inside the shared Aricon email design (SPEC §11). */
const CONTENT: {
  [E in NotificationEvent]: (
    payload: NotificationPayloads[E],
    store: EmailStore,
  ) => EmailContent;
} = {
  'user.welcome': (x, store) => ({
    subject: `Welcome to ${store.storeName}`,
    kicker: 'Welcome',
    heading: `Welcome, ${x.name}`,
    blocks: [
      p(
        'Your account is ready. See bulk prices for your quantity, order with cash on delivery or bank transfer, and track every order in your account.',
      ),
      button('Start shopping', x.shopUrl),
    ],
  }),
  'auth.password_reset': (x) => ({
    subject: 'Reset your password',
    kicker: 'Account security',
    heading: 'Let’s get you back in.',
    blocks: [
      p(
        `Hi ${x.name}, we got a request to reset your password. The link works for ${x.expiresInMinutes} minutes.`,
      ),
      button('Reset your password', x.resetUrl, 'pink'),
      note(
        "If you didn't request a password reset, you can safely ignore this email. Your password won't change.",
        'pink',
        'Wasn’t you?',
      ),
    ],
  }),
  'auth.verify_email': (x) => ({
    subject: 'Verify your email address',
    kicker: 'Confirm your email',
    heading: 'One click and you’re in.',
    blocks: [
      p(
        `Hi ${x.name}, confirm this is your email address to finish setting up your Aricon Shop account. The link works for ${x.expiresInMinutes} minutes.`,
      ),
      button('Verify my email', x.verifyUrl),
      note(
        "If you didn't create an account, you can safely ignore this email.",
        'pink',
        'Wasn’t you?',
      ),
    ],
  }),
  'order.placed': (x) => ({
    subject: `Order ${x.orderNumber} placed`,
    kicker: 'Order confirmation',
    heading: 'Your order is in.',
    reference: x.orderNumber,
    blocks: [
      p(
        `Hi ${x.name}, we got your order ${x.orderNumber}. We'll confirm it soon.`,
      ),
      sectionTitle('A little recap of your order'),
      products(x.items),
      summary(
        ['Subtotal', formatPKR(x.subtotal)],
        ...((x.discount ?? 0) > 0
          ? ([['Discount', `− ${formatPKR(x.discount ?? 0)}`]] as [
              string,
              string,
            ][])
          : []),
        ['Delivery', x.deliveryFee === 0 ? 'Free' : formatPKR(x.deliveryFee)],
        ['Payment', PAYMENT_METHOD_LABELS[x.paymentMethod]],
        ['Total', formatPKR(x.total)],
      ),
      ...(x.trackingCode ? [code('TRACKING CODE', x.trackingCode)] : []),
      ...(x.bankTransfer
        ? [
            note(
              'Please transfer the total to one of these accounts, then upload your receipt from the order page.',
              'blue',
              'Pay by bank transfer',
            ),
            ...x.bankTransfer.accounts.map((account) =>
              rows(
                ['Bank', account.bankName],
                ['Account title', account.accountTitle],
                ['Account number', account.accountNumber],
                ...(account.iban ? [['IBAN', account.iban] as const] : []),
              ),
            ),
            ...(x.bankTransfer.instructions
              ? [note(x.bankTransfer.instructions)]
              : []),
            button('Upload receipt', x.orderUrl),
          ]
        : [
            note(
              "Pay in cash when your order arrives. We'll call before delivery.",
              'blue',
              'Cash on delivery',
            ),
            button('View your order', x.orderUrl),
          ]),
    ],
  }),
  'order.placed.staff': (x) => ({
    subject: `New order ${x.orderNumber} · ${formatPKR(x.total)}`,
    kicker: 'New order notification',
    heading: 'A new order just came in.',
    brandSub: 'SHOP · STAFF',
    reference: x.orderNumber,
    blocks: [
      sectionTitle('Order details'),
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
    kicker: 'Payment update',
    heading: 'A bank receipt is waiting',
    brandSub: 'SHOP · STAFF',
    reference: x.orderNumber,
    blocks: [
      p(
        `The customer uploaded a payment receipt for order ${x.orderNumber}. Check it and approve or reject it.`,
      ),
      button('Review receipt', x.adminUrl),
    ],
  }),
  'order.payment_received': (x) => ({
    subject: `Payment received for ${x.orderNumber}`,
    kicker: 'Payment update',
    heading: 'Payment received',
    reference: x.orderNumber,
    blocks: [
      p(
        `Hi ${x.name}, we checked your bank transfer for order ${x.orderNumber}. It's paid.`,
      ),
      button('View order', x.orderUrl),
    ],
  }),
  'order.payment_rejected': (x) => ({
    subject: `Payment receipt not accepted for ${x.orderNumber}`,
    kicker: 'Payment update',
    heading: "We couldn't accept your receipt",
    reference: x.orderNumber,
    blocks: [
      p(
        `Hi ${x.name}, we couldn't match the receipt you uploaded for order ${x.orderNumber}.`,
      ),
      rows(['Reason', x.reason]),
      p('Please upload a clear receipt of the transfer.'),
      button('Upload again', x.uploadUrl, 'pink'),
    ],
  }),
  'order.confirmed': (x) => ({
    subject: `Order ${x.orderNumber} confirmed`,
    kicker: 'Order update',
    heading: 'Your order is confirmed',
    reference: x.orderNumber,
    blocks: [
      p(
        `Hi ${x.name}, we confirmed order ${x.orderNumber} and are getting it ready.`,
      ),
      button('View order', x.orderUrl),
    ],
  }),
  'order.dispatched': (x) => ({
    subject: `Order ${x.orderNumber} is on the way`,
    kicker: 'Shipping update',
    heading: 'Your order is on the way',
    reference: x.orderNumber,
    blocks: [
      p(`Hi ${x.name}, order ${x.orderNumber} has left our warehouse.`),
      rows(['Rider', x.riderName], ['Rider phone', x.riderPhone]),
      button('View order', x.orderUrl),
    ],
  }),
  'order.delivered': (x) => ({
    subject: `Order ${x.orderNumber} delivered`,
    kicker: 'Delivery update',
    heading: 'Your order was delivered',
    reference: x.orderNumber,
    blocks: [
      p(
        `Hi ${x.name}, order ${x.orderNumber} was delivered. Thank you for ordering with us.`,
      ),
      button('Download invoice', x.invoiceUrl),
    ],
  }),
  'order.cancelled': (x) => ({
    subject: `Order ${x.orderNumber} cancelled`,
    kicker: 'Order update',
    heading: 'Your order was cancelled',
    reference: x.orderNumber,
    blocks: [
      p(`Hi ${x.name}, order ${x.orderNumber} was cancelled.`),
      note(x.reason, 'pink', 'Reason'),
      button('View order', x.orderUrl, 'lav'),
    ],
  }),
  'rfp.inquiry': (x) => ({
    subject: `Project inquiry from ${x.company}`,
    kicker: 'Project inquiry',
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
      note(x.brief, 'blue', 'Project brief'),
      p('Reply to this email to answer the inquirer directly.'),
    ],
  }),
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only http(s) links become buttons; anything else would be a trap in an email. */
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : '#';
}

const FONT = 'font-family:Arial,Helvetica,sans-serif';

const TONE_STYLES: Record<
  Tone,
  { background: string; border: string; button: string; buttonText: string }
> = {
  blue: {
    background: '#F3F8FF',
    border: '#E6EFFB',
    button: '#DCEBFC',
    buttonText: '#285B91',
  },
  pink: {
    background: '#FFF6F9',
    border: '#F8E9EF',
    button: '#FCE7EF',
    buttonText: '#914C69',
  },
  lav: {
    background: '#F8F6FF',
    border: '#EEEAFE',
    button: '#ECE8FF',
    buttonText: '#5E5098',
  },
};

function blockHtml(block: Block): string {
  switch (block.kind) {
    case 'p':
      return `<p style="${FONT};font-size:14px;line-height:24px;color:#526170;margin:0 0 15px">${escapeHtml(block.text)}</p>`;
    case 'title':
      return `<p style="${FONT};font-size:12px;font-weight:bold;color:#344353;margin:22px 0 10px">${escapeHtml(block.text)}</p>`;
    case 'note': {
      const tone = block.tone
        ? TONE_STYLES[block.tone]
        : { background: '#F7F9FC', border: '#EDF1F5' };
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:17px 0;border:1px solid ${tone.border};border-radius:10px;background:${tone.background}"><tr><td style="padding:14px 15px">${block.title ? `<p style="${FONT};font-size:12px;font-weight:bold;color:#2C3B49;margin:0 0 5px">${escapeHtml(block.title)}</p>` : ''}<p style="${FONT};font-size:12px;line-height:20px;color:#526170;margin:0;white-space:pre-line">${escapeHtml(block.text)}</p></td></tr></table>`;
    }
    case 'rows':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 18px;border-collapse:collapse">${block.rows
        .map(
          ([label, value]) =>
            `<tr><td style="${FONT};font-size:12px;color:#8995A0;padding:9px 12px 9px 0;border-bottom:1px solid #EFF1F3">${escapeHtml(label)}</td><td style="${FONT};font-size:12px;font-weight:600;color:#354352;padding:9px 0;border-bottom:1px solid #EFF1F3;text-align:right">${escapeHtml(value)}</td></tr>`,
        )
        .join('')}</table>`;
    case 'summary':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;border-collapse:collapse">${block.rows
        .map(([label, value], index) => {
          const total = index === block.rows.length - 1;
          return `<tr><td style="${FONT};font-size:${total ? 14 : 12}px;${total ? 'font-weight:bold;color:#1D2B38;padding-top:12px' : 'color:#84909C;padding:7px 0'};border-bottom:${total ? '0' : '1px solid #F0F2F4'}">${escapeHtml(label)}</td><td style="${FONT};font-size:${total ? 14 : 12}px;${total ? 'font-weight:bold;color:#1D2B38;padding-top:12px' : 'color:#344353;padding:7px 0'};border-bottom:${total ? '0' : '1px solid #F0F2F4'};text-align:right">${escapeHtml(value)}</td></tr>`;
        })
        .join('')}</table>`;
    case 'products':
      return block.items
        .map(
          (
            item,
          ) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 17px;border:1px solid #E9EDF1;border-radius:11px"><tr>
<td width="76" valign="middle" style="padding:12px"><table role="presentation" width="76" height="70" cellpadding="0" cellspacing="0" style="background:#F0F5FA;border-radius:8px"><tr><td align="center" style="${FONT};font-size:10px;color:#8B9AAA">Product</td></tr></table></td>
<td valign="middle" style="padding:12px 5px"><strong style="${FONT};font-size:13px;color:#263442">${escapeHtml(item.productName)}</strong><br><span style="${FONT};font-size:11px;line-height:18px;color:#84909C">${escapeHtml(item.variantLabel)} · Quantity: ${item.qty}</span></td>
<td valign="middle" align="right" style="${FONT};font-size:13px;font-weight:bold;color:#263442;padding:12px">${escapeHtml(formatPKR(item.lineTotal))}</td>
</tr></table>`,
        )
        .join('');
    case 'code':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px dashed #CBD9E8;border-radius:11px;background:#F6FAFF"><tr><td align="center" style="padding:17px"><div style="${FONT};font-size:10px;letter-spacing:1.3px;color:#7F8FA0;font-weight:bold">${escapeHtml(block.label)}</div><div style="${FONT};font-size:26px;letter-spacing:5px;font-weight:bold;color:#263E59;margin-top:8px">${escapeHtml(block.value)}</div></td></tr></table>`;
    case 'button': {
      const tone = TONE_STYLES[block.tone ?? 'blue'];
      const url = safeUrl(block.url);
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 3px"><tr><td bgcolor="${tone.button}" style="border-radius:8px"><a href="${escapeHtml(url)}" style="${FONT};display:inline-block;color:${tone.buttonText};font-size:13px;font-weight:bold;text-decoration:none;padding:12px 19px;border-radius:8px">${escapeHtml(block.label)}&nbsp; →</a></td></tr></table><p style="${FONT};font-size:11px;line-height:18px;color:#8A96A1;overflow-wrap:anywhere;margin:10px 0 13px">If the button doesn’t work, visit: <a href="${escapeHtml(url)}" style="color:#8A96A1">${escapeHtml(url)}</a></p>`;
    }
  }
}

function blockText(block: Block): string {
  switch (block.kind) {
    case 'p':
    case 'title':
      return block.text;
    case 'note':
      return block.title ? `${block.title}\n${block.text}` : block.text;
    case 'rows':
    case 'summary':
      return block.rows
        .map(([label, value]) => `${label}: ${value}`)
        .join('\n');
    case 'products':
      return block.items
        .map(
          (item) =>
            `${item.productName} (${item.variantLabel}) · Quantity: ${item.qty} · ${formatPKR(item.lineTotal)}`,
        )
        .join('\n');
    case 'code':
      return `${block.label}: ${block.value}`;
    case 'button':
      return `${block.label}: ${safeUrl(block.url)}`;
  }
}

/** Renders one notification as a branded HTML email plus its plain-text twin (SPEC §11). */
export function renderEmail<E extends NotificationEvent>(
  event: E,
  payload: NotificationPayloads[E],
  store: EmailStore,
): RenderedEmail {
  const content = CONTENT[event](payload, store);
  const footer = [
    store.storeName,
    store.address,
    [store.phone, store.email].filter(Boolean).join(' · '),
  ].filter(Boolean);
  const reference = content.reference
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:5px 0 18px;border:1px solid #E9EDF1;border-radius:8px;background:#FBFCFD"><tr><td style="${FONT};font-size:12px;color:#536170;padding:9px 12px">Order reference&nbsp; <strong style="color:#253342;letter-spacing:.35px">${escapeHtml(content.reference)}</strong></td></tr></table>`
    : '';

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:0;background:#F5F7FA">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FA;padding:34px 15px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E9EDF1;border-radius:14px;box-shadow:0 8px 30px rgba(24,39,56,.035)">
<tr><td style="padding:27px 32px 29px">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 30px"><tr>
<td valign="middle" width="29" height="29" align="center" bgcolor="#EAF3FF" style="border-radius:8px;${FONT};font-size:13px;font-weight:bold;letter-spacing:-.5px;color:#3569A8">A</td>
<td valign="middle" style="padding-left:9px"><a href="${escapeHtml(safeUrl(store.appUrl))}" style="text-decoration:none"><div style="${FONT};font-size:12px;letter-spacing:1.5px;font-weight:bold;color:#263442">ARICON</div><div style="${FONT};font-size:10px;color:#96A0AA;letter-spacing:.2px">${escapeHtml(content.brandSub ?? 'SHOP')}</div></a></td>
</tr></table>
<p style="${FONT};font-size:10px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:#8B96A2;margin:0 0 12px">${escapeHtml(content.kicker)}</p>
<h1 style="${FONT};font-size:34px;line-height:38px;letter-spacing:-1.25px;font-weight:bold;color:#17212B;margin:0 0 17px">${escapeHtml(content.heading)}</h1>
${reference}
${content.blocks.map(blockHtml).join('\n')}
</td></tr>
<tr><td style="border-top:1px solid #F0F2F4;${FONT};font-size:10px;line-height:18px;color:#99A3AD;padding:17px 32px 20px"><strong style="color:#65717D">${escapeHtml(footer[0] ?? '')}</strong>${footer
    .slice(1)
    .map((line) => `<br>${escapeHtml(line)}`)
    .join('')}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    content.kicker,
    content.heading,
    ...(content.reference ? [`Order reference: ${content.reference}`] : []),
    '',
    ...content.blocks.map(blockText).flatMap((part) => [part, '']),
    '—',
    ...footer,
  ].join('\n');
  return { subject: content.subject, html, text };
}
