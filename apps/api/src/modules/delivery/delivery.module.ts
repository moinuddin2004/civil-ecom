import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { AdminDeliveryController } from './admin-delivery.controller.js';
import { AdminDeliveryService } from './admin-delivery.service.js';
import { DeliveryAreasRepository } from './delivery-areas.repository.js';
import { DeliveryController } from './delivery.controller.js';
import { DeliveryService } from './delivery.service.js';
import { RidersRepository } from './riders.repository.js';

/** Delivery areas and riders: the public area list, plus their admin management (SPEC §7.2–7.3). */
@Module({
  imports: [SettingsModule],
  controllers: [DeliveryController, AdminDeliveryController],
  providers: [DeliveryAreasRepository, RidersRepository, DeliveryService, AdminDeliveryService],
  exports: [DeliveryAreasRepository, RidersRepository, DeliveryService],
})
export class DeliveryModule {}
