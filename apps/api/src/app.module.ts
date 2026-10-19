import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module.js';
import { AppConfigModule } from './config/app-config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { ModelsModule } from './models/models.module.js';
import { AccountModule } from './modules/account/account.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { DeliveryModule } from './modules/delivery/delivery.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { JobsModule } from './modules/jobs/jobs.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { RevalidationModule } from './modules/revalidation/revalidation.module.js';
import { RfpModule } from './modules/rfp/rfp.module.js';
import { StaffModule } from './modules/staff/staff.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { UsersModule } from './modules/users/users.module.js';

/**
 * Root module: infrastructure first (config → cross-cutting → database), then one module per
 * feature under `modules/` (CLAUDE.md §8.1). Order matters for global guards: CommonModule's
 * (rate limit, Origin) run before AuthModule's.
 */
@Module({
  imports: [
    AppConfigModule,
    CommonModule,
    DatabaseModule,
    ModelsModule,
    JobsModule,
    NotificationsModule,
    StorageModule,
    AuditModule,
    RevalidationModule,
    UsersModule,
    AuthModule,
    HealthModule,
    SettingsModule,
    CatalogModule,
    DeliveryModule,
    CartModule,
    AccountModule,
    OrdersModule,
    RfpModule,
    StaffModule,
    CustomersModule,
    ProductsModule,
    ReportsModule,
    UploadsModule,
  ],
})
export class AppModule {}
