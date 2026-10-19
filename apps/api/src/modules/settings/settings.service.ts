import { PAGE_TITLES, pageKeyFromSlug, type PageDTO, type PublicSettingsDTO } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import type { ClientSession } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import type { StoreSettings } from '../../models/settings.model.js';
import { SettingsRepository } from './settings.repository.js';

/** Store settings for other modules, plus their public views (SPEC §7.2). */
@Injectable()
export class SettingsService {
  constructor(private readonly settings: SettingsRepository) {}

  /** Full settings for server-side use (delivery fees, checkout rules). Never send these as-is. */
  get(session?: ClientSession): Promise<StoreSettings> {
    return this.settings.get(session);
  }

  /** What the store shows: contact details, enabled payment methods, COD limit, bank accounts. */
  async publicSettings(): Promise<PublicSettingsDTO> {
    const settings = await this.settings.get();
    return {
      storeName: settings.storeName,
      phone: settings.phone,
      whatsapp: settings.whatsapp,
      email: settings.email,
      address: settings.address,
      paymentMethods: { cod: settings.paymentMethods.cod, bankTransfer: settings.paymentMethods.bankTransfer },
      codMaxOrderAmount: settings.codMaxOrderAmount,
      defaultDeliveryFee: settings.defaultDeliveryFee,
      // Shown even when bank transfer is switched off: customers with an unpaid bank-transfer order
      // still need them.
      bankAccounts: settings.bankAccounts.map((account) => ({
        id: account._id ? String(account._id) : '',
        bankName: account.bankName,
        accountTitle: account.accountTitle,
        accountNumber: account.accountNumber,
        iban: account.iban || null,
        raastId: account.raastId || null,
      })),
      bankTransferInstructions: settings.bankTransferInstructions,
    };
  }

  /** A content page by its URL slug (`refund-policy`); 404 for anything else. */
  async page(slug: string): Promise<PageDTO> {
    const key = pageKeyFromSlug(slug);
    if (!key) throw AppError.notFound("We couldn't find that page.");
    const settings = await this.settings.get();
    return { key: slug, title: PAGE_TITLES[key], body: settings.pages[key] };
  }
}
