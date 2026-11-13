import {
  CACHE_TAGS,
  checkTransition,
  karachiDateKey,
  ORDER_STATUS_LABELS,
  type AdminOrderDTO,
  type AdminOrderListItemDTO,
  type OrderStatus,
  type PaymentStatus,
} from '@aricon/shared';
import { Injectable, type StreamableFile } from '@nestjs/common';
import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../../common/errors/app-error.js';
import { Paginated } from '../../../common/http/envelope.js';
import { AppConfig } from '../../../config/app-config.service.js';
import { TransactionService } from '../../../database/transaction.service.js';
import type { OrderLean } from '../../../models/order.model.js';
import { AuditService, type AuditActor } from '../../audit/audit.service.js';
import type { Principal } from '../../auth/auth.types.js';
import { RidersRepository } from '../../delivery/riders.repository.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { REVALIDATE_STOCK_MS, RevalidationService } from '../../revalidation/revalidation.service.js';
import { toStateSnapshot } from '../order.mappers.js';
import { OrderStockService } from '../order-stock.service.js';
import { OrdersRepository } from '../orders.repository.js';
import { xlsxDownload } from '../../spreadsheets/xlsx.js';
import { toAdminOrderListItem } from './admin-order.mappers.js';
import { ordersExportSheet } from './admin-orders.export.js';
import { AdminOrdersRepository, type AdminOrderFilters, type AdminOrderSort } from './admin-orders.repository.js';

const ORDER_NOT_FOUND = "We couldn't find that order.";
const CHANGED_MEANWHILE = 'Someone else changed this order a moment ago. Reload it and try again.';
/** Statuses in which an order's rider can still be set or changed. */
const RIDER_CHANGEABLE: readonly OrderStatus[] = ['NEW', 'CONFIRMED', 'DISPATCHED'];
const CLOSED: readonly OrderStatus[] = ['CANCELLED', 'RETURNED'];

export interface StatusChangeInput {
  to: OrderStatus;
  note?: string;
  reason?: string;
}

/**
 * Order management for staff (SPEC §6.7–6.8, §7.3 "Orders"). Each action re-checks the order's state
 * inside its transaction and applies the change only if nothing moved in between; side effects
 * (restock, audit) commit with it; emails go after commit.
 */
@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly adminOrders: AdminOrdersRepository,
    private readonly orders: OrdersRepository,
    private readonly riders: RidersRepository,
    private readonly orderStock: OrderStockService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly revalidation: RevalidationService,
    private readonly config: AppConfig,
  ) {}

  async list(filters: AdminOrderFilters, page: number, pageSize: number, sort: AdminOrderSort): Promise<Paginated<AdminOrderListItemDTO>> {
    const [result, statusCounts] = await Promise.all([
      this.adminOrders.list(filters, page, pageSize, sort),
      this.adminOrders.statusCounts(filters),
    ]);
    return new Paginated(result.data.map(toAdminOrderListItem), result.meta, { statusCounts });
  }

  /** `GET /api/admin/orders/export`: every order the filters select, streamed into an .xlsx. */
  export(filters: AdminOrderFilters, sort: AdminOrderSort): StreamableFile {
    return xlsxDownload(`orders-${karachiDateKey(new Date())}.xlsx`, [ordersExportSheet(this.adminOrders.exportCursor(filters, sort))]);
  }

  async detail(id: string): Promise<AdminOrderDTO> {
    return this.toDto(await this.find(id));
  }

  /** SPEC §6.7: the shared status table decides what's allowed for this staff member. */
  async changeStatus(principal: Principal, actor: AuditActor, id: string, input: StatusChangeInput): Promise<AdminOrderDTO> {
    const { order, before } = await this.transactions.run(async (session) => {
      const current = await this.find(id, session);
      const check = checkTransition(
        toStateSnapshot(current),
        input.to,
        { type: 'staff', user: { role: principal.role, permissions: principal.permissions } },
        { reason: input.reason },
      );
      if (!check.ok) {
        const issues = check.code === 'VALIDATION_ERROR' ? [{ path: 'reason', message: check.message }] : undefined;
        throw new AppError(check.code, check.message, issues);
      }

      const now = new Date();
      const updated = await this.adminOrders.updateIf(
        current._id,
        { status: current.status },
        {
          $set: {
            status: input.to,
            paymentStatus: check.paymentStatusAfter,
            ...(input.to === 'CANCELLED' && { cancelReason: input.reason }),
          },
          $push: {
            statusHistory: {
              status: input.to,
              at: now,
              byUserId: new Types.ObjectId(actor.id),
              byType: 'staff',
              note: input.to === 'CANCELLED' ? input.reason : (input.note ?? input.reason),
            },
          },
        },
        session,
      );
      if (!updated) throw AppError.conflict(CHANGED_MEANWHILE);

      if (check.transition.restock) {
        const note = `Order ${updated.orderNumber} ${ORDER_STATUS_LABELS[input.to].toLowerCase()}`;
        await this.orderStock.restock(updated, check.transition.restock, note, new Types.ObjectId(actor.id), session);
      }
      await this.audit.record(
        actor,
        {
          action: 'order.status_changed',
          entity: 'order',
          entityId: id,
          before: { status: current.status, paymentStatus: current.paymentStatus },
          after: { status: updated.status, paymentStatus: updated.paymentStatus, ...(input.reason && { reason: input.reason }) },
        },
        session,
      );
      return { order: updated, before: current };
    });

    if (order.status === 'CANCELLED' || order.status === 'RETURNED') {
      const dto = await this.toDto(order);
      const slugs = dto.items.flatMap((item) => (item.productSlug ? [CACHE_TAGS.product(item.productSlug)] : []));
      this.revalidation.revalidate([CACHE_TAGS.catalog, ...slugs], REVALIDATE_STOCK_MS);
    }
    await this.notifyStatus(order, before.status);
    return this.toDto(order);
  }

  async assignRider(actor: AuditActor, id: string, riderId: string): Promise<AdminOrderDTO> {
    const order = await this.transactions.run(async (session) => {
      const current = await this.find(id, session);
      if (!RIDER_CHANGEABLE.includes(current.status)) {
        throw new AppError('INVALID_TRANSITION', `The rider can't be changed on a ${ORDER_STATUS_LABELS[current.status].toLowerCase()} order.`);
      }
      const rider = await this.riders.findById(riderId, session);
      if (!rider || !rider.isActive) {
        const message = 'Choose an active rider.';
        throw AppError.validation(message, [{ path: 'riderId', message }]);
      }
      const updated = await this.adminOrders.updateIf(
        current._id,
        { status: current.status },
        { $set: { riderId: rider._id, rider: { name: rider.name, phone: rider.phone } } },
        session,
      );
      if (!updated) throw AppError.conflict(CHANGED_MEANWHILE);
      await this.audit.record(
        actor,
        {
          action: 'order.rider_assigned',
          entity: 'order',
          entityId: id,
          before: { riderId: current.riderId ? String(current.riderId) : null, rider: current.rider?.name ?? null },
          after: { riderId: String(rider._id), rider: rider.name },
        },
        session,
      );
      return updated;
    });
    return this.toDto(order);
  }

  /**
   * SPEC §6.8 COD: allowed once the order is out (dispatched or delivered); marks it paid. An amount
   * different from the total needs a note (the audit log keeps both).
   */
  async codCollected(actor: AuditActor, id: string, amount: number, note: string | undefined): Promise<AdminOrderDTO> {
    const order = await this.transactions.run(async (session) => {
      const current = await this.find(id, session);
      if (current.paymentMethod !== 'COD') throw new AppError('INVALID_TRANSITION', 'This order is not cash on delivery.');
      if (current.status !== 'DISPATCHED' && current.status !== 'DELIVERED') {
        throw new AppError('INVALID_TRANSITION', 'Record cash once the order is dispatched or delivered.');
      }
      if (current.paymentStatus === 'PAID') throw new AppError('INVALID_TRANSITION', 'Cash for this order is already recorded.');
      if (amount !== current.total && !note) {
        const message = 'Add a note explaining why the amount differs from the order total.';
        throw AppError.validation(message, [{ path: 'note', message }]);
      }

      const updated = await this.adminOrders.updateIf(
        current._id,
        { status: current.status, paymentStatus: current.paymentStatus },
        {
          $set: {
            paymentStatus: 'PAID',
            codCollected: { amount, at: new Date(), byUserId: new Types.ObjectId(actor.id), ...(note && { note }) },
          },
        },
        session,
      );
      if (!updated) throw AppError.conflict(CHANGED_MEANWHILE);
      await this.audit.record(
        actor,
        {
          action: 'order.cod_collected',
          entity: 'order',
          entityId: id,
          before: { paymentStatus: current.paymentStatus },
          after: { paymentStatus: 'PAID', amount, total: current.total, ...(note && { note }) },
        },
        session,
      );
      return updated;
    });
    return this.toDto(order);
  }

  async approveReceipt(actor: AuditActor, id: string, receiptId: string): Promise<AdminOrderDTO> {
    return this.reviewReceipt(actor, id, receiptId, { approve: true });
  }

  async rejectReceipt(actor: AuditActor, id: string, receiptId: string, reason: string): Promise<AdminOrderDTO> {
    return this.reviewReceipt(actor, id, receiptId, { approve: false, reason });
  }

  async setInternalNote(actor: AuditActor, id: string, internalNote: string): Promise<AdminOrderDTO> {
    const order = await this.transactions.run(async (session) => {
      const current = await this.find(id, session);
      const next = internalNote.trim();
      const updated = await this.adminOrders.updateIf(
        current._id,
        {},
        next ? { $set: { internalNote: next } } : { $unset: { internalNote: 1 } },
        session,
      );
      if (!updated) throw AppError.notFound(ORDER_NOT_FOUND);
      if ((current.internalNote ?? '') !== next) {
        await this.audit.record(
          actor,
          {
            action: 'order.internal_note_changed',
            entity: 'order',
            entityId: id,
            before: { internalNote: current.internalNote ?? null },
            after: { internalNote: next || null },
          },
          session,
        );
      }
      return updated;
    });
    return this.toDto(order);
  }

  /**
   * SPEC §6.8 receipts: approve → paid; reject → receipt rejected and, with no other pending receipt,
   * payment REJECTED (the customer can upload again).
   */
  private async reviewReceipt(
    actor: AuditActor,
    id: string,
    receiptId: string,
    decision: { approve: true } | { approve: false; reason: string },
  ): Promise<AdminOrderDTO> {
    const order = await this.transactions.run(async (session) => {
      const current = await this.find(id, session);
      if (current.paymentMethod !== 'BANK_TRANSFER') throw new AppError('INVALID_TRANSITION', 'This order is not paid by bank transfer.');
      if (CLOSED.includes(current.status)) {
        throw new AppError('INVALID_TRANSITION', `This order is ${ORDER_STATUS_LABELS[current.status].toLowerCase()}.`);
      }
      const receipt = current.receipts.find((item) => String(item._id) === receiptId);
      if (!receipt) throw AppError.notFound("We couldn't find that receipt.");
      if (receipt.status !== 'pending') throw new AppError('INVALID_TRANSITION', 'This receipt has already been reviewed.');

      const now = new Date();
      const reviewer = new Types.ObjectId(actor.id);
      const otherPending = current.receipts.some((item) => item.status === 'pending' && String(item._id) !== receiptId);
      const paymentStatus: PaymentStatus = decision.approve ? 'PAID' : otherPending ? current.paymentStatus : 'REJECTED';
      const updated = await this.adminOrders.reviewPendingReceipt(
        current._id,
        current.status,
        receipt._id,
        {
          paymentStatus,
          'receipts.$.status': decision.approve ? 'approved' : 'rejected',
          'receipts.$.reviewedByUserId': reviewer,
          'receipts.$.reviewedAt': now,
          ...(!decision.approve && { 'receipts.$.rejectReason': decision.reason }),
        },
        session,
      );
      if (!updated) throw AppError.conflict(CHANGED_MEANWHILE);
      await this.audit.record(
        actor,
        {
          action: decision.approve ? 'order.payment_approved' : 'order.payment_rejected',
          entity: 'order',
          entityId: id,
          before: { paymentStatus: current.paymentStatus, receiptId, receiptStatus: 'pending' },
          after: {
            paymentStatus,
            receiptId,
            receiptStatus: decision.approve ? 'approved' : 'rejected',
            ...(!decision.approve && { reason: decision.reason }),
          },
        },
        session,
      );
      return updated;
    });

    const appUrl = this.config.get('APP_URL');
    const orderUrl = `${appUrl}/account/orders/${order.orderNumber}`;
    if (decision.approve) {
      await this.notifications.notify('order.payment_received', {
        to: order.user.email,
        name: order.user.name,
        orderNumber: order.orderNumber,
        orderUrl,
      });
    } else {
      await this.notifications.notify('order.payment_rejected', {
        to: order.user.email,
        name: order.user.name,
        orderNumber: order.orderNumber,
        reason: decision.reason,
        uploadUrl: orderUrl,
      });
    }
    return this.toDto(order);
  }

  /** The order, or a 404. */
  findOrThrow(id: string): Promise<OrderLean> {
    return this.find(id);
  }

  private async find(id: string, session?: ClientSession): Promise<OrderLean> {
    const order = await this.adminOrders.findById(id, session);
    if (!order) throw AppError.notFound(ORDER_NOT_FOUND);
    return order;
  }

  /** Emails for the customer after a status change (SPEC §11). */
  private async notifyStatus(order: OrderLean, from: OrderStatus): Promise<void> {
    if (order.status === from) return;
    const appUrl = this.config.get('APP_URL');
    const base = {
      to: order.user.email,
      name: order.user.name,
      orderNumber: order.orderNumber,
      orderUrl: `${appUrl}/account/orders/${order.orderNumber}`,
    };
    switch (order.status) {
      case 'CONFIRMED':
        return this.notifications.notify('order.confirmed', base);
      case 'DISPATCHED':
        return this.notifications.notify('order.dispatched', {
          ...base,
          riderName: order.rider?.name ?? '',
          riderPhone: order.rider?.phone ?? '',
        });
      case 'DELIVERED':
        return this.notifications.notify('order.delivered', {
          ...base,
          invoiceUrl: `${appUrl}/api/orders/${order.orderNumber}/invoice`,
        });
      case 'CANCELLED':
        return this.notifications.notify('order.cancelled', { ...base, reason: order.cancelReason ?? '' });
      default:
        return undefined;
    }
  }

  private async toDto(order: OrderLean): Promise<AdminOrderDTO> {
    const [names, slugs] = await Promise.all([
      this.adminOrders.userNames([
        ...order.statusHistory.map((entry) => entry.byUserId),
        ...order.receipts.map((receipt) => receipt.reviewedByUserId),
        order.codCollected?.byUserId,
      ]),
      this.orders.productSlugs(order.items.map((item) => item.productId)),
    ]);
    const nameOf = (id: Types.ObjectId | undefined) => (id ? (names.get(String(id)) ?? null) : null);
    return {
      id: String(order._id),
      orderNumber: order.orderNumber,
      trackingCode: order.trackingCode ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      userId: String(order.userId),
      customer: { name: order.user.name, email: order.user.email, phone: order.user.phone },
      shippingAddress: {
        label: order.shippingAddress.label,
        contactName: order.shippingAddress.contactName,
        phone: order.shippingAddress.phone,
        line1: order.shippingAddress.line1,
        line2: order.shippingAddress.line2 ?? null,
        landmark: order.shippingAddress.landmark ?? null,
        areaId: String(order.shippingAddress.areaId),
        areaName: order.shippingAddress.areaName,
        city: order.shippingAddress.city,
      },
      deliveryAreaId: String(order.deliveryAreaId),
      items: order.items.map((item) => ({
        productId: String(item.productId),
        variantId: String(item.variantId),
        sku: item.sku,
        productName: item.productName,
        productSlug: slugs.get(String(item.productId)) ?? null,
        variantLabel: item.variantLabel,
        brandName: item.brandName,
        unit: item.unit,
        imageKey: item.imageKey ?? null,
        qty: item.qty,
        mrp: item.mrp,
        basePrice: item.basePrice,
        unitPrice: item.unitPrice,
        appliedTierMinQty: item.appliedTierMinQty ?? null,
        lineTotal: item.lineTotal,
      })),
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      discount: order.discountAmount ?? 0,
      discountReason: order.discountReason ?? null,
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      receipts: order.receipts.map((receipt) => ({
        id: String(receipt._id),
        mimeType: receipt.mimeType,
        sizeBytes: receipt.sizeBytes,
        uploadedAt: receipt.uploadedAt.toISOString(),
        status: receipt.status,
        rejectReason: receipt.rejectReason ?? null,
        reviewedAt: receipt.reviewedAt?.toISOString() ?? null,
        reviewedByName: nameOf(receipt.reviewedByUserId),
      })),
      status: order.status,
      statusHistory: order.statusHistory.map((entry) => ({
        status: entry.status,
        at: entry.at.toISOString(),
        byType: entry.byType,
        byUserName: nameOf(entry.byUserId),
        note: entry.note ?? null,
      })),
      riderId: order.riderId ? String(order.riderId) : null,
      rider: order.rider ? { name: order.rider.name, phone: order.rider.phone } : null,
      codCollected: order.codCollected
        ? {
            amount: order.codCollected.amount,
            at: order.codCollected.at.toISOString(),
            byName: nameOf(order.codCollected.byUserId),
            note: order.codCollected.note ?? null,
          }
        : null,
      customerNote: order.customerNote ?? null,
      internalNote: order.internalNote ?? null,
      cancelReason: order.cancelReason ?? null,
    };
  }
}
