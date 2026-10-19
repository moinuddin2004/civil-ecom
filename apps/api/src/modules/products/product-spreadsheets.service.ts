import { karachiDateKey } from '@aricon/shared';
import { Injectable, type StreamableFile } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service.js';
import { CategoriesRepository } from '../catalog/catalog.repositories.js';
import { xlsxDownload } from '../spreadsheets/xlsx.js';
import { AdminProductsRepository, type AdminProductFilters } from './admin-products.repository.js';
import { productExportSheet, templateSheets } from './product-sheet.js';

/** The product spreadsheets (SPEC §7.3, §12.3): the import template and the products export. */
@Injectable()
export class ProductSpreadsheetsService {
  constructor(
    private readonly products: AdminProductsRepository,
    private readonly categories: CategoriesRepository,
    private readonly config: AppConfig,
  ) {}

  template(): StreamableFile {
    return xlsxDownload('product-import-template.xlsx', templateSheets());
  }

  /** Same columns as the template, so the file can be edited and imported back. */
  async export(filters: AdminProductFilters): Promise<StreamableFile> {
    const categories = await this.categories.findAll();
    const sheet = productExportSheet(this.products.exportCursor(filters), {
      categorySlugs: new Map(categories.map((category) => [String(category._id), category.slug])),
      publicImageBaseUrl: this.config.get('PUBLIC_IMAGE_BASE_URL'),
    });
    return xlsxDownload(`products-${karachiDateKey(new Date())}.xlsx`, [sheet]);
  }
}
