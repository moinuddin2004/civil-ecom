import {
  karachiDateKey,
  type AdminCustomerDetailDTO,
  type AdminCustomerListItemDTO,
  type UserStatus,
} from '@aricon/shared';
import { Injectable, type StreamableFile } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { isDuplicateKey } from '../../common/errors/mongo-errors.js';
import { Paginated } from '../../common/http/envelope.js';
import { TransactionService } from '../../database/transaction.service.js';
import { AuditService, type AuditActor } from '../audit/audit.service.js';
import { AuthUserCache } from '../auth/auth-user-cache.service.js';
import { TokenService } from '../auth/token.service.js';
import { DeliveryAreasRepository } from '../delivery/delivery-areas.repository.js';
import { toAdminOrderListItem } from '../orders/admin/admin-order.mappers.js';
import { xlsxDownload } from '../spreadsheets/xlsx.js';
import { UsersRepository } from '../users/users.repository.js';
import { customersExportSheet } from './customers.export.js';
import {
  CustomersRepository,
  type CustomerFilters,
  type CustomerRow,
} from './customers.repository.js';

const RECENT_ORDERS = 10;
const CUSTOMER_NOT_FOUND = "We couldn't find that customer.";
const EMAIL_IN_USE =
  'An active account already uses this email. Change that account before restoring this one.';
const PHONE_IN_USE =
  'An active account already uses this mobile number. Change that account before restoring this one.';

function toListItem(row: CustomerRow): AdminCustomerListItemDTO {
  return {
    id: String(row._id),
    name: row.name,
    email: row.email,
    phone: row.phone ?? '',
    companyName: row.companyName ?? null,
    orderCount: row.orderCount,
    totalSpent: row.totalSpent,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

/** The customer directory and blocking (SPEC §7.3 "Customers", §6.11). */
@Injectable()
export class CustomersService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly customers: CustomersRepository,
    private readonly users: UsersRepository,
    private readonly areas: DeliveryAreasRepository,
    private readonly tokens: TokenService,
    private readonly cache: AuthUserCache,
    private readonly audit: AuditService,
  ) {}

  async list(
    filters: CustomerFilters,
    page: number,
    pageSize: number,
  ): Promise<Paginated<AdminCustomerListItemDTO>> {
    const result = await this.customers.list(filters, page, pageSize);
    return new Paginated(result.data.map(toListItem), result.meta);
  }

  /** `GET /api/admin/customers/export`: every customer the filters select, streamed into an .xlsx. */
  export(filters: CustomerFilters): StreamableFile {
    return xlsxDownload(`customers-${karachiDateKey(new Date())}.xlsx`, [
      customersExportSheet(this.customers.exportCursor(filters)),
    ]);
  }

  async detail(id: string): Promise<AdminCustomerDetailDTO> {
    const customer = await this.customers.findOne(id);
    if (!customer) throw AppError.notFound(CUSTOMER_NOT_FOUND);
    const [orders, areas] = await Promise.all([
      this.customers.recentOrders(customer._id, RECENT_ORDERS),
      this.areas.findByIds(customer.addresses.map((address) => address.areaId)),
    ]);
    const areaName = new Map(
      areas.map((area) => [String(area._id), area.name]),
    );
    return {
      ...toListItem(customer),
      addresses: customer.addresses.map((address) => ({
        id: String(address._id),
        label: address.label,
        contactName: address.contactName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2 ?? null,
        landmark: address.landmark ?? null,
        areaName: areaName.get(String(address.areaId)) ?? null,
        city: address.city,
        isDefault: address.isDefault,
      })),
      recentOrders: orders.map(toAdminOrderListItem),
      lastLoginAt: customer.lastLoginAt?.toISOString() ?? null,
    };
  }

  /** Blocking signs the customer out everywhere at once (SPEC §6.11). */
  async setStatus(
    actor: AuditActor,
    id: string,
    status: UserStatus,
    note: string | null | undefined,
  ): Promise<AdminCustomerDetailDTO> {
    const changed = await this.transactions.run(async (session) => {
      const customer = await this.users.findById(id, session);
      if (!customer || customer.role !== 'CUSTOMER' || customer.deletedAt)
        throw AppError.notFound(CUSTOMER_NOT_FOUND);
      if (customer.status === status) return false;
      await this.users.updateFields(id, { status }, [], session);
      await this.audit.record(
        actor,
        {
          action: status === 'blocked' ? 'user.blocked' : 'user.unblocked',
          entity: 'user',
          entityId: id,
          before: { status: customer.status },
          after: note ? { status, note } : { status },
        },
        session,
      );
      return true;
    });

    if (changed && status === 'blocked')
      await this.tokens.revokeAllForUser(id, 'blocked');
    if (changed) this.cache.invalidate(id);
    return this.detail(id);
  }

  async delete(actor: AuditActor, id: string): Promise<AdminCustomerDetailDTO> {
    const changed = await this.transactions.run(async (session) => {
      const customer = await this.users.findById(id, session);
      if (!customer || customer.role !== 'CUSTOMER')
        throw AppError.notFound(CUSTOMER_NOT_FOUND);
      if (customer.deletedAt) return false;

      const deletedAt = new Date();
      const after = await this.users.updateFields(
        id,
        { deletedAt },
        [],
        session,
      );
      if (!after) throw AppError.notFound(CUSTOMER_NOT_FOUND);
      await this.audit.record(
        actor,
        {
          action: 'user.deleted',
          entity: 'user',
          entityId: id,
          before: { deletedAt: null },
          after: { deletedAt },
        },
        session,
      );
      return true;
    });

    if (changed) {
      await this.tokens.revokeAllForUser(id, 'deleted');
      this.cache.invalidate(id);
    }
    return this.detail(id);
  }

  async restore(
    actor: AuditActor,
    id: string,
  ): Promise<AdminCustomerDetailDTO> {
    let changed: boolean;
    try {
      changed = await this.transactions.run(async (session) => {
        const customer = await this.users.findById(id, session);
        if (!customer || customer.role !== 'CUSTOMER')
          throw AppError.notFound(CUSTOMER_NOT_FOUND);
        if (!customer.deletedAt) return false;
        if (await this.users.emailTakenByOther(customer.email, id))
          throw new AppError('EMAIL_TAKEN', EMAIL_IN_USE);
        if (
          customer.phone &&
          (await this.users.phoneTakenByOther(customer.phone, id))
        )
          throw new AppError('PHONE_TAKEN', PHONE_IN_USE);

        const after = await this.users.updateFields(
          id,
          {},
          ['deletedAt'],
          session,
        );
        if (!after) throw AppError.notFound(CUSTOMER_NOT_FOUND);
        await this.audit.record(
          actor,
          {
            action: 'user.restored',
            entity: 'user',
            entityId: id,
            before: { deletedAt: customer.deletedAt },
            after: { deletedAt: null },
          },
          session,
        );
        return true;
      });
    } catch (error) {
      if (isDuplicateKey(error, 'phone'))
        throw new AppError('PHONE_TAKEN', PHONE_IN_USE);
      if (isDuplicateKey(error, 'email'))
        throw new AppError('EMAIL_TAKEN', EMAIL_IN_USE);
      throw error;
    }
    if (changed) this.cache.invalidate(id);
    return this.detail(id);
  }
}
