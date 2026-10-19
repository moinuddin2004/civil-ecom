import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { UsersModule } from '../users/users.module.js';
import { AdminProductsController } from './admin-products.controller.js';
import { AdminProductsRepository } from './admin-products.repository.js';
import { AdminProductsService } from './admin-products.service.js';
import { ImportJobsRepository } from './import-jobs.repository.js';
import { ProductImportService } from './product-import.service.js';
import { ProductSpreadsheetsService } from './product-spreadsheets.service.js';

/** Product management for staff (SPEC §7.3 "Products and stock"). The storefront reads live in CatalogModule. */
@Module({
  imports: [CatalogModule, InventoryModule, SettingsModule, UsersModule],
  controllers: [AdminProductsController],
  providers: [AdminProductsRepository, AdminProductsService, ImportJobsRepository, ProductImportService, ProductSpreadsheetsService],
})
export class ProductsModule {}
