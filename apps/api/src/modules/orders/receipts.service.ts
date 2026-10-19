import { canUploadReceipt, MAX_PENDING_RECEIPTS, receiptKey, type CustomerOrderDTO, type FileLinkDTO } from '@aricon/shared';
import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { AppConfig } from '../../config/app-config.service.js';
import { TransactionService } from '../../database/transaction.service.js';
import type { OrderLean } from '../../models/order.model.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { FileProcessingService, type UploadedFileInput } from '../storage/file-processing.service.js';
import { PRIVATE_URL_TTL_SECONDS, StorageService } from '../storage/storage.service.js';
import { AdminOrdersRepository } from './admin/admin-orders.repository.js';
import { CustomerOrdersService } from './customer-orders.service.js';
import { OrdersRepository } from './orders.repository.js';

const ORDER_NOT_FOUND = "We couldn't find that order.";

/** Why a receipt can't be added, in words the customer can act on. */
function refusal(order: OrderLean): string {
  if (order.paymentMethod !== 'BANK_TRANSFER') return 'Receipts are only needed for bank transfer orders.';
  if (order.paymentStatus === 'PAID') return 'This order is already paid.';
  if (order.status !== 'NEW' && order.status !== 'CONFIRMED') return "This order can't take a receipt any more.";
  return `You already have ${MAX_PENDING_RECEIPTS} receipts waiting to be checked. We'll review them soon.`;
}

/**
 * Bank-transfer receipts (SPEC §6.8): the customer uploads, staff look at the file through a
 * 10-minute link. Approve/reject live with the other staff order actions (AdminOrdersService).
 */
@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    private readonly transactions: TransactionService,
    private readonly orders: OrdersRepository,
    private readonly adminOrders: AdminOrdersRepository,
    private readonly customerOrders: CustomerOrdersService,
    private readonly files: FileProcessingService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly config: AppConfig,
  ) {}

  /**
   * `POST /api/orders/:orderNumber/receipts`. The file is checked and stored first (no database
   * work for a bad file), then added in a transaction that re-checks the order; if that fails the
   * stored file is removed again.
   */
  async upload(userId: string, orderNumber: string, file: UploadedFileInput | undefined): Promise<CustomerOrderDTO> {
    const processed = await this.files.receipt(file);
    const order = await this.orders.findOwn(userId, orderNumber);
    if (!order) throw AppError.notFound(ORDER_NOT_FOUND);
    if (!canUploadReceipt(order, MAX_PENDING_RECEIPTS)) throw AppError.conflict(refusal(order));

    const receiptId = new Types.ObjectId();
    const key = receiptKey(String(order._id), receiptId.toHexString(), processed.extension);
    await this.storage.putPrivate(key, processed.body, processed.mimeType);

    let updated: OrderLean;
    try {
      updated = await this.transactions.run(async (session) => {
        const current = await this.orders.findOwn(userId, orderNumber, session);
        if (!current) throw AppError.notFound(ORDER_NOT_FOUND);
        if (!canUploadReceipt(current, MAX_PENDING_RECEIPTS)) throw AppError.conflict(refusal(current));
        const saved = await this.orders.addReceipt(
          current._id,
          { _id: receiptId, key, mimeType: processed.mimeType, sizeBytes: processed.body.length, uploadedAt: new Date() },
          session,
        );
        if (!saved) throw AppError.notFound(ORDER_NOT_FOUND);
        return saved;
      });
    } catch (error) {
      await this.storage.deletePrivate([key]).catch((cleanup: unknown) => {
        this.logger.warn({ err: cleanup, key }, 'Could not remove a receipt file after a failed upload');
      });
      throw error;
    }

    const settings = await this.settings.get();
    if (settings.orderNotificationEmails.length > 0) {
      await this.notifications.notify('order.receipt_uploaded.staff', {
        to: settings.orderNotificationEmails,
        orderNumber: updated.orderNumber,
        adminUrl: `${this.config.get('APP_URL')}/admin/orders/${String(updated._id)}`,
      });
    }
    return this.customerOrders.toDto(updated);
  }

  /** `GET /api/admin/orders/:id/receipts/:receiptId/url` (`orders.view`): a 10-minute link. */
  async staffLink(orderId: string, receiptId: string): Promise<FileLinkDTO> {
    const order = await this.adminOrders.findById(orderId);
    const receipt = order?.receipts.find((item) => String(item._id) === receiptId);
    if (!order || !receipt) throw AppError.notFound("We couldn't find that receipt.");
    const extension = receipt.key.slice(receipt.key.lastIndexOf('.'));
    const url = await this.storage.privateUrl(receipt.key, `receipt-${order.orderNumber}${extension}`);
    return { url, expiresAt: new Date(Date.now() + PRIVATE_URL_TTL_SECONDS * 1000).toISOString() };
  }
}
