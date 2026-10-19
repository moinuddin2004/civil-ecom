import { CACHE_TAGS, type AdminSettingsDTO, type PageKey } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { TransactionService } from '../../database/transaction.service.js';
import { SETTINGS_ID, type StoreSettings } from '../../models/settings.model.js';
import { AuditService, changedFields, type AuditActor } from '../audit/audit.service.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import type { UpdateSettingsDto } from './dto/admin-settings.dto.js';
import { SettingsRepository } from './settings.repository.js';

const AUDITED_FIELDS = [
  'storeName',
  'phone',
  'whatsapp',
  'email',
  'address',
  'orderNotificationEmails',
  'rfpEmail',
  'paymentMethods',
  'codMaxOrderAmount',
  'defaultDeliveryFee',
  'bankAccounts',
  'bankTransferInstructions',
  'lowStockDefault',
  'pages',
] as const;

/** A plain copy of the pages (every key listed, so a new page can't be forgotten). */
function copyPages(pages: Readonly<Record<PageKey, string>>): Record<PageKey, string> {
  return {
    about: pages.about,
    faq: pages.faq,
    contact: pages.contact,
    refundPolicy: pages.refundPolicy,
    deliveryPolicy: pages.deliveryPolicy,
    privacyPolicy: pages.privacyPolicy,
    terms: pages.terms,
  };
}

export function toAdminSettingsDto(settings: StoreSettings): AdminSettingsDTO {
  return {
    storeName: settings.storeName,
    phone: settings.phone,
    whatsapp: settings.whatsapp,
    email: settings.email,
    address: settings.address,
    orderNotificationEmails: [...settings.orderNotificationEmails],
    rfpEmail: settings.rfpEmail,
    paymentMethods: { cod: settings.paymentMethods.cod, bankTransfer: settings.paymentMethods.bankTransfer },
    codMaxOrderAmount: settings.codMaxOrderAmount,
    defaultDeliveryFee: settings.defaultDeliveryFee,
    bankAccounts: settings.bankAccounts.map((account) => ({
      id: account._id ? String(account._id) : '',
      bankName: account.bankName,
      accountTitle: account.accountTitle,
      accountNumber: account.accountNumber,
      iban: account.iban || null,
      raastId: account.raastId || null,
    })),
    bankTransferInstructions: settings.bankTransferInstructions,
    lowStockDefault: settings.lowStockDefault,
    pages: copyPages(settings.pages),
    updatedAt: settings.updatedAt?.toISOString() ?? null,
  };
}

/** Store settings for ADMINs (SPEC §10.12): read, and replace as a whole with an audit of what changed. */
@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly settings: SettingsRepository,
    private readonly audit: AuditService,
    private readonly revalidation: RevalidationService,
  ) {}

  async get(): Promise<AdminSettingsDTO> {
    return toAdminSettingsDto(await this.settings.get());
  }

  async update(actor: AuditActor, input: UpdateSettingsDto): Promise<AdminSettingsDTO> {
    if (!input.paymentMethods.cod && !input.paymentMethods.bankTransfer) {
      const message = 'Keep at least one payment method on.';
      throw AppError.validation(message, [{ path: 'paymentMethods', message }]);
    }

    const saved = await this.transactions.run(async (session) => {
      const before = await this.settings.get(session);
      const after = await this.settings.replace(
        {
          storeName: input.storeName,
          phone: input.phone,
          whatsapp: input.whatsapp,
          email: input.email,
          address: input.address,
          orderNotificationEmails: [...new Set(input.orderNotificationEmails)],
          rfpEmail: input.rfpEmail,
          paymentMethods: { cod: input.paymentMethods.cod, bankTransfer: input.paymentMethods.bankTransfer },
          codMaxOrderAmount: input.codMaxOrderAmount ?? null,
          defaultDeliveryFee: input.defaultDeliveryFee,
          bankAccounts: input.bankAccounts.map((account) => ({
            // Existing accounts keep their id, so the checkout page's copy buttons stay stable.
            _id: new Types.ObjectId(account.id),
            bankName: account.bankName,
            accountTitle: account.accountTitle,
            accountNumber: account.accountNumber,
            iban: account.iban,
            raastId: account.raastId,
          })),
          bankTransferInstructions: input.bankTransferInstructions,
          lowStockDefault: input.lowStockDefault,
          pages: copyPages(input.pages),
        },
        session,
      );
      const diff = changedFields(before, after, AUDITED_FIELDS);
      if (Object.keys(diff.after).length > 0) {
        await this.audit.record(actor, { action: 'settings.updated', entity: 'settings', entityId: SETTINGS_ID, ...diff }, session);
      }
      return after;
    });

    // Contact details, payment options, pages and the default delivery fee are all on public pages.
    this.revalidation.revalidate([CACHE_TAGS.settings, CACHE_TAGS.pages, CACHE_TAGS.deliveryAreas]);
    return toAdminSettingsDto(saved);
  }
}
