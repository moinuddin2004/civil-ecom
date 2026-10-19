import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module.js';
import { DeliveryModule } from '../delivery/delivery.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { UsersModule } from '../users/users.module.js';
import { AdminOrdersController } from './admin/admin-orders.controller.js';
import { AdminOrdersRepository } from './admin/admin-orders.repository.js';
import { AdminOrdersService } from './admin/admin-orders.service.js';
import { CustomerOrdersController } from './customer-orders.controller.js';
import { CustomerOrdersService } from './customer-orders.service.js';
import { OrderNumbersRepository } from './order-numbers.repository.js';
import { OrderPlacementService } from './order-placement.service.js';
import { OrderStockService } from './order-stock.service.js';
import { OrdersRepository } from './orders.repository.js';
import { InvoiceService } from './invoice.service.js';
import { ReceiptsService } from './receipts.service.js';

/** Orders: customer placement and history (SPEC §6.6–6.9, §7.2) and staff management (§7.3). */
@Module({
  imports: [CartModule, UsersModule, DeliveryModule, InventoryModule, SettingsModule],
  controllers: [CustomerOrdersController, AdminOrdersController],
  providers: [
    OrdersRepository,
    AdminOrdersRepository,
    OrderNumbersRepository,
    OrderStockService,
    OrderPlacementService,
    CustomerOrdersService,
    AdminOrdersService,
    ReceiptsService,
    InvoiceService,
  ],
  exports: [OrdersRepository],
})
export class OrdersModule {}
