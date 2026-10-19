import { Module } from '@nestjs/common';
import { AdminCatalogController } from './admin/admin-catalog.controller.js';
import { AdminCatalogService } from './admin/admin-catalog.service.js';
import { AdminHomepageController } from './admin/admin-homepage.controller.js';
import { AdminHomepageService } from './admin/admin-homepage.service.js';
import { CatalogController } from './catalog.controller.js';
import {
  BrandsRepository,
  CatalogProductsRepository,
  CategoriesRepository,
  HomepageRepository,
} from './catalog.repositories.js';
import { CatalogService } from './catalog.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

/** The catalog: public browsing (SPEC §7.2) and admin categories, brands and homepage (SPEC §7.3). */
@Module({
  controllers: [CatalogController, ProductsController, AdminCatalogController, AdminHomepageController],
  providers: [
    CategoriesRepository,
    BrandsRepository,
    CatalogProductsRepository,
    HomepageRepository,
    CatalogService,
    ProductsService,
    AdminCatalogService,
    AdminHomepageService,
  ],
  exports: [CategoriesRepository, BrandsRepository, CatalogProductsRepository, HomepageRepository],
})
export class CatalogModule {}
