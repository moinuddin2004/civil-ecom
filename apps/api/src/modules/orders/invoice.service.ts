import {
  formatDateTime,
  formatPKR,
  formatQty,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { OrderLean } from '../../models/order.model.js';
import type { StoreSettings } from '../../models/settings.model.js';
import { SettingsService } from '../settings/settings.service.js';

export interface InvoiceFile {
  body: Buffer;
  fileName: string;
}

const INK = '#1E2A33';
const MUTED = '#6B7680';
const LINE = '#E4E7EA';
const MARGIN = 48;

/** Table columns: x position and width on an A4 page (595 pt wide). */
const COLUMNS = {
  item: { x: MARGIN, width: 230 },
  qty: { x: 282, width: 70 },
  unit: { x: 356, width: 85 },
  total: { x: 445, width: 102 },
} as const;

/**
 * Order invoice PDF (SPEC §7.2 / §7.3 "invoice", §9 "Download invoice"). Built from the order's own
 * snapshot (prices, names and address as they were ordered), so it never changes when the catalog
 * does. It shows the order's current status and payment status as they are. Uses the PDF base
 * fonts, so nothing has to be installed on the server.
 */
@Injectable()
export class InvoiceService {
  constructor(private readonly settings: SettingsService) {}

  async render(order: OrderLean): Promise<InvoiceFile> {
    const settings = await this.settings.get();
    const body = await toBuffer((doc) => this.draw(doc, order, settings));
    return { body, fileName: `invoice-${order.orderNumber}.pdf` };
  }

  private draw(doc: PDFKit.PDFDocument, order: OrderLean, settings: StoreSettings): void {
    const right = doc.page.width - MARGIN;

    // Store header and invoice title.
    doc.font('Helvetica-Bold').fontSize(20).fillColor(INK).text(settings.storeName, MARGIN, MARGIN);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    for (const line of [settings.address, settings.phone, settings.email].filter(Boolean)) doc.text(line, { width: 260 });
    doc.font('Helvetica-Bold').fontSize(16).fillColor(INK).text('Invoice', 0, MARGIN, { width: right, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    doc.text(order.orderNumber, 0, MARGIN + 24, { width: right, align: 'right' });
    doc.text(formatDateTime(order.createdAt), { width: right, align: 'right' });

    // Bill to / deliver to.
    let y = Math.max(doc.y, MARGIN + 80) + 18;
    const address = order.shippingAddress;
    this.block(doc, 'Customer', [order.user.name, order.user.phone, order.user.email], MARGIN, y);
    this.block(
      doc,
      'Deliver to',
      [
        `${address.contactName} · ${address.phone}`,
        address.line1,
        address.line2 ?? '',
        address.landmark ? `Landmark: ${address.landmark}` : '',
        `${address.areaName}, ${address.city}`,
      ].filter(Boolean),
      300,
      y,
    );
    y = doc.y + 24;

    // Items.
    this.row(doc, y, { item: 'Item', qty: 'Qty', unit: 'Unit price', total: 'Total' }, true);
    y += 18;
    doc.moveTo(MARGIN, y).lineTo(right, y).strokeColor(LINE).stroke();
    y += 8;
    for (const item of order.items) {
      if (y > doc.page.height - 200) {
        doc.addPage();
        y = MARGIN;
      }
      const tier = item.appliedTierMinQty ? ` (bulk price from ${item.appliedTierMinQty})` : '';
      const height = this.row(doc, y, {
        item: `${item.productName}\n${item.variantLabel} · SKU ${item.sku}${tier}`,
        qty: formatQty(item.qty, item.unit),
        unit: formatPKR(item.unitPrice),
        total: formatPKR(item.lineTotal),
      });
      y += height + 8;
      doc.moveTo(MARGIN, y - 4).lineTo(right, y - 4).strokeColor(LINE).stroke();
    }

    // Totals.
    y += 6;
    for (const [label, value, bold] of [
      ['Subtotal', formatPKR(order.subtotal), false],
      ['Delivery', order.deliveryFee === 0 ? 'Free' : formatPKR(order.deliveryFee), false],
      ['Total', formatPKR(order.total), true],
    ] as const) {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).fillColor(INK);
      doc.text(label, COLUMNS.unit.x, y, { width: COLUMNS.unit.width });
      doc.text(value, COLUMNS.total.x, y, { width: COLUMNS.total.width, align: 'right' });
      y += bold ? 20 : 16;
    }

    // Payment and status.
    y += 12;
    this.block(
      doc,
      'Payment',
      [`${PAYMENT_METHOD_LABELS[order.paymentMethod]} · ${PAYMENT_STATUS_LABELS[order.paymentStatus]}`],
      MARGIN,
      y,
    );
    this.block(doc, 'Order status', [ORDER_STATUS_LABELS[order.status]], 300, y);

    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
      `Thank you for ordering from ${settings.storeName}. Prices are in Pakistani rupees.`,
      MARGIN,
      doc.page.height - MARGIN - 12,
      { width: right - MARGIN, align: 'center' },
    );
  }

  private block(doc: PDFKit.PDFDocument, title: string, lines: readonly string[], x: number, y: number): void {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text(title.toUpperCase(), x, y, { width: 240 });
    doc.font('Helvetica').fontSize(10).fillColor(INK);
    for (const line of lines) doc.text(line, x, doc.y + 2, { width: 240 });
  }

  /** One table row; returns its height (the item cell may wrap). */
  private row(doc: PDFKit.PDFDocument, y: number, cells: Record<keyof typeof COLUMNS, string>, header = false): number {
    doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(header ? 9 : 10).fillColor(header ? MUTED : INK);
    const heights = (Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]).map((column) => {
      const { x, width } = COLUMNS[column];
      const options = { width, align: column === 'item' ? ('left' as const) : ('right' as const) };
      doc.text(cells[column], x, y, options);
      return doc.heightOfString(cells[column], options);
    });
    return Math.max(...heights);
  }
}

/** Runs a PDFKit drawing and collects the bytes. */
function toBuffer(draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, info: { Title: 'Invoice', Producer: 'Aricon Shop' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    draw(doc);
    doc.end();
  });
}
