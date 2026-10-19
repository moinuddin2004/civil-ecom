import { CACHE_TAGS, DEFAULT_CITY, type AdminDeliveryAreaDTO, type RiderDTO } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { isDuplicateKey } from '../../common/errors/mongo-errors.js';
import { definedOnly } from '../../common/utils/objects.js';
import { TransactionService } from '../../database/transaction.service.js';
import type { DeliveryAreaLean } from '../../models/delivery-area.model.js';
import type { RiderLean } from '../../models/rider.model.js';
import { AuditService, changedFields, type AuditActor } from '../audit/audit.service.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import { DeliveryAreasRepository, type AreaFields } from './delivery-areas.repository.js';
import type { CreateDeliveryAreaDto, CreateRiderDto, UpdateDeliveryAreaDto, UpdateRiderDto } from './dto/admin-delivery.dto.js';
import { RidersRepository } from './riders.repository.js';

const AREA_FIELDS = ['name', 'city', 'isServiceable', 'deliveryFee', 'freeDeliveryAbove', 'sortOrder'] as const;
const RIDER_FIELDS = ['name', 'phone', 'isActive'] as const;

export function toAdminAreaDto(area: DeliveryAreaLean): AdminDeliveryAreaDTO {
  return {
    id: String(area._id),
    name: area.name,
    city: area.city,
    isServiceable: area.isServiceable,
    deliveryFee: area.deliveryFee,
    freeDeliveryAbove: area.freeDeliveryAbove,
    sortOrder: area.sortOrder,
  };
}

export function toRiderDto(rider: RiderLean): RiderDTO {
  return { id: String(rider._id), name: rider.name, phone: rider.phone, isActive: rider.isActive };
}

const areaTaken = (name: string, city: string) => AppError.conflict(`There is already an area called ${name} in ${city}.`);

/**
 * Delivery areas and riders for the admin panel (SPEC §7.3 "Delivery"). Every write is audited in the
 * same transaction; area changes refresh the storefront's area list and fees.
 */
@Injectable()
export class AdminDeliveryService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly areas: DeliveryAreasRepository,
    private readonly riders: RidersRepository,
    private readonly audit: AuditService,
    private readonly revalidation: RevalidationService,
  ) {}

  async listAreas(): Promise<AdminDeliveryAreaDTO[]> {
    return (await this.areas.findAll()).map(toAdminAreaDto);
  }

  async createArea(actor: AuditActor, input: CreateDeliveryAreaDto): Promise<AdminDeliveryAreaDTO> {
    const fields: AreaFields = {
      name: input.name,
      city: input.city ?? DEFAULT_CITY,
      isServiceable: input.isServiceable ?? true,
      deliveryFee: input.deliveryFee ?? null,
      freeDeliveryAbove: input.freeDeliveryAbove ?? null,
      sortOrder: input.sortOrder ?? 0,
    };
    try {
      const area = await this.transactions.run(async (session) => {
        const created = await this.areas.create(fields, session);
        await this.audit.record(
          actor,
          { action: 'deliveryArea.created', entity: 'deliveryArea', entityId: String(created._id), after: { ...fields } },
          session,
        );
        return created;
      });
      this.revalidation.revalidate([CACHE_TAGS.deliveryAreas]);
      return toAdminAreaDto(area);
    } catch (error) {
      if (isDuplicateKey(error)) throw areaTaken(fields.name, fields.city);
      throw error;
    }
  }

  /** SPEC §6.12: an area in use is switched off (`isServiceable: false`), never deleted. */
  async updateArea(actor: AuditActor, id: string, input: UpdateDeliveryAreaDto): Promise<AdminDeliveryAreaDTO> {
    const changes = definedOnly(input, AREA_FIELDS);
    try {
      const area = await this.transactions.run(async (session) => {
        const before = await this.areas.findById(id, session);
        if (!before) throw AppError.notFound("We couldn't find that delivery area.");
        const after = await this.areas.update(id, changes, session);
        if (!after) throw AppError.notFound("We couldn't find that delivery area.");
        const diff = changedFields(before, after, AREA_FIELDS);
        if (Object.keys(diff.after).length > 0) {
          await this.audit.record(actor, { action: 'deliveryArea.updated', entity: 'deliveryArea', entityId: id, ...diff }, session);
        }
        return after;
      });
      this.revalidation.revalidate([CACHE_TAGS.deliveryAreas]);
      return toAdminAreaDto(area);
    } catch (error) {
      if (isDuplicateKey(error)) throw areaTaken(input.name ?? 'that name', input.city ?? 'this city');
      throw error;
    }
  }

  async listRiders(): Promise<RiderDTO[]> {
    return (await this.riders.findAll()).map(toRiderDto);
  }

  async createRider(actor: AuditActor, input: CreateRiderDto): Promise<RiderDTO> {
    const fields = { name: input.name, phone: input.phone, isActive: input.isActive ?? true };
    const rider = await this.transactions.run(async (session) => {
      const created = await this.riders.create(fields, session);
      await this.audit.record(actor, { action: 'rider.created', entity: 'rider', entityId: String(created._id), after: fields }, session);
      return created;
    });
    return toRiderDto(rider);
  }

  /** Riders are deactivated, never deleted (orders keep a snapshot of name and phone). */
  async updateRider(actor: AuditActor, id: string, input: UpdateRiderDto): Promise<RiderDTO> {
    const rider = await this.transactions.run(async (session) => {
      const before = await this.riders.findById(id, session);
      if (!before) throw AppError.notFound("We couldn't find that rider.");
      const after = await this.riders.update(id, definedOnly(input, RIDER_FIELDS), session);
      if (!after) throw AppError.notFound("We couldn't find that rider.");
      const diff = changedFields(before, after, RIDER_FIELDS);
      if (Object.keys(diff.after).length > 0) {
        await this.audit.record(actor, { action: 'rider.updated', entity: 'rider', entityId: id, ...diff }, session);
      }
      return after;
    });
    return toRiderDto(rider);
  }
}
