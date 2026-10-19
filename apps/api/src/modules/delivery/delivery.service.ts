import { baseDeliveryFee, type DeliveryAreaDTO, type DeliverySettings } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import type { DeliveryAreaLean } from '../../models/delivery-area.model.js';
import { SettingsService } from '../settings/settings.service.js';
import { DeliveryAreasRepository } from './delivery-areas.repository.js';

export function toDeliveryAreaDto(area: DeliveryAreaLean, settings: DeliverySettings): DeliveryAreaDTO {
  return {
    id: String(area._id),
    name: area.name,
    city: area.city,
    isServiceable: area.isServiceable,
    deliveryFee: baseDeliveryFee(area, settings),
    freeDeliveryAbove: area.freeDeliveryAbove,
  };
}

/** Delivery areas and their fees (SPEC §5.8, §6.4). */
@Injectable()
export class DeliveryService {
  constructor(
    private readonly areas: DeliveryAreasRepository,
    private readonly settings: SettingsService,
  ) {}

  /** `GET /api/delivery-areas`: all areas with the fee they actually charge (area fee or the default). */
  async publicAreas(): Promise<DeliveryAreaDTO[]> {
    const [areas, settings] = await Promise.all([this.areas.findAll(), this.settings.get()]);
    return areas.map((area) => toDeliveryAreaDto(area, settings));
  }
}
