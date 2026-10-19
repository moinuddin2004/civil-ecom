import {
  effectivePermissions,
  hasPermission,
  importFileKey,
  MAX_PRODUCT_IMAGES,
  productImageFileKey,
  productImagePrefix,
  slugify,
  type AdminProductDTO,
  type BulkTier,
  type ImportJobDTO,
  type Permission,
} from '@aricon/shared';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import ExcelJS from 'exceljs';
import { Types } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { flattenValidationErrors } from '../../common/validation/validation.js';
import type { ImportRowError } from '../../models/import-job.model.js';
import type { ProductLean } from '../../models/product.model.js';
import { AuditService, type AuditActor } from '../audit/audit.service.js';
import type { Principal } from '../auth/auth.types.js';
import { BrandsRepository, CategoriesRepository } from '../catalog/catalog.repositories.js';
import { JobsService } from '../jobs/jobs.service.js';
import { FileProcessingService, type UploadedFileInput } from '../storage/file-processing.service.js';
import { StorageService } from '../storage/storage.service.js';
import { XLSX_MIME } from '../spreadsheets/xlsx.js';
import { UsersRepository } from '../users/users.repository.js';
import { AdminProductsRepository } from './admin-products.repository.js';
import { AdminProductsService } from './admin-products.service.js';
import { CreateProductDto, UpdateProductDto, VariantCreateInput, VariantUpdateInput } from './dto/admin-products.dto.js';
import { downloadImage } from './image-download.js';
import { ImportJobsRepository, toImportJobDto } from './import-jobs.repository.js';
import { PRODUCT_SHEET_COLUMNS, PRODUCT_SHEET_NAME, SHEET_TIERS, type ProductSheetColumn } from './product-sheet.js';

/** One spreadsheet row: its Excel row number and the template columns it has values in. */
interface SheetRow {
  row: number;
  cells: Partial<Record<ProductSheetColumn, string>>;
}

type Who = Pick<Principal, 'role' | 'permissions'>;

interface RunContext {
  jobId: string;
  who: Who;
  actor: AuditActor;
  brands: ReadonlyMap<string, string>;
  categories: ReadonlyMap<string, string>;
  summary: { created: number; updated: number; failed: number };
  errors: ImportRowError[];
}

/** A problem with one row, shown to the importer as it is. */
class RowError extends Error {}

/** A file the import can't read at all (the job fails with this message). */
class ImportFileError extends Error {}

const MAX_ROWS = 5_000;

const OPTION_COLUMNS = [
  ['pack_size', 'packSize'],
  ['grade', 'grade'],
  ['colour', 'colour'],
  ['size', 'size'],
] as const satisfies readonly (readonly [ProductSheetColumn, string])[];

function isFieldIssue(value: unknown): value is { path: string; message: string } {
  return typeof value === 'object' && value !== null && 'path' in value && 'message' in value && typeof value.path === 'string' && typeof value.message === 'string';
}

/** API field paths → the sheet's column names, so row errors name the column to fix. */
const FIELD_COLUMNS: Record<string, string> = {
  sku: 'sku',
  label: 'variant_label',
  mrp: 'mrp',
  price: 'price',
  lowStockThreshold: 'low_stock_threshold',
  'options.packSize': 'pack_size',
  'options.grade': 'grade',
  'options.colour': 'colour',
  'options.size': 'size',
  name: 'product_name',
  slug: 'product_slug',
  brandId: 'brand',
  categoryId: 'category_slug',
  unit: 'unit',
  type: 'type',
  description: 'description',
  status: 'status',
};

function columnOf(path: string): string {
  const tier = /bulkTiers\.(\d+)\.(minQty|price)$/.exec(path);
  if (tier) return `tier${Number(tier[1]) + 1}_${tier[2] === 'minQty' ? 'min_qty' : 'price'}`;
  const plain = path.replace(/^variants\.\d+\./, '');
  return FIELD_COLUMNS[plain] ?? plain;
}

/** An API error as row text: the field problems with their column, or the message. */
function describe(error: unknown): string {
  if (error instanceof RowError) return error.message;
  if (error instanceof AppError) {
    const details: unknown[] = Array.isArray(error.details) ? error.details : [];
    const fields = details.filter(isFieldIssue).map((detail) => `${columnOf(detail.path)}: ${detail.message}`);
    return fields.length > 0 ? fields.join(' ') : error.message;
  }
  return 'This row could not be saved.';
}

/** Text of a cell whatever Excel stored (number, rich text, link, formula result). */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if ('richText' in value) return value.richText.map((part) => part.text).join('').trim();
  if ('hyperlink' in value) return typeof value.text === 'string' ? value.text.trim() : value.hyperlink;
  if ('result' in value) return value.result === undefined ? '' : cellText(value.result as ExcelJS.CellValue);
  return '';
}

/** A whole number from a cell (thousands separators allowed); undefined when empty. */
function whole(row: SheetRow, column: ProductSheetColumn): number | undefined {
  const text = (row.cells[column] ?? '').replace(/[,\s]/g, '');
  if (!text) return undefined;
  if (!/^-?\d+$/.test(text)) throw new RowError(`${column}: use a whole number (no decimals).`);
  return Number(text);
}

function text(row: SheetRow, column: ProductSheetColumn): string | undefined {
  const value = row.cells[column]?.trim();
  return value ? value : undefined;
}

/** The sheet's bulk tiers, or undefined when every tier column is empty. */
function tiers(row: SheetRow): BulkTier[] | undefined {
  const list: BulkTier[] = [];
  let any = false;
  for (let index = 1; index <= SHEET_TIERS; index += 1) {
    const minQty = whole(row, `tier${index}_min_qty` as ProductSheetColumn);
    const price = whole(row, `tier${index}_price` as ProductSheetColumn);
    if (minQty === undefined && price === undefined) continue;
    any = true;
    if (minQty === undefined || price === undefined) throw new RowError(`tier${index}: fill in both the quantity and the price.`);
    list.push({ minQty, price });
  }
  return any ? list : undefined;
}

function sameTiers(a: readonly BulkTier[], b: readonly BulkTier[]): boolean {
  return a.length === b.length && a.every((tier, index) => tier.minQty === b[index]?.minQty && tier.price === b[index]?.price);
}

/** Validates like the API endpoints do (same DTO classes and rules), throwing a row error. */
async function validated<T extends object>(type: ClassConstructor<T>, plain: object): Promise<T> {
  const instance = plainToInstance(type, plain);
  const issues = flattenValidationErrors(await validate(instance, { whitelist: true, forbidNonWhitelisted: true }));
  if (issues.length > 0) throw new RowError(issues.map((issue) => `${columnOf(issue.path)}: ${issue.message}`).join(' '));
  return instance;
}

/**
 * Excel product import (SPEC §12.3). `start()` checks and stores the file and queues the job;
 * `run()` is the `import-products` job. Rows are grouped into products by slug and upserted by SKU
 * through the same product service the admin panel uses — so price/stock permissions, validation,
 * the audit log and storefront refresh all behave exactly as in the editor. Every row is saved or
 * reported on its own; one bad row never stops the rest.
 */
@Injectable()
export class ProductImportService implements OnModuleInit {
  private readonly logger = new Logger(ProductImportService.name);

  constructor(
    private readonly jobs: ImportJobsRepository,
    private readonly products: AdminProductsRepository,
    private readonly productService: AdminProductsService,
    private readonly brandsRepository: BrandsRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly users: UsersRepository,
    private readonly files: FileProcessingService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly queue: JobsService,
  ) {}

  onModuleInit(): void {
    // One import at a time (SPEC §13); a big file may run for minutes.
    this.queue.register('import-products', ({ jobId }) => this.run(jobId), { concurrency: 1, lockLifetimeMs: 30 * 60_000 });
  }

  /** `POST /api/admin/products/import`: store the file, record the job, queue it. */
  async start(userId: string, file: UploadedFileInput | undefined): Promise<string> {
    const body = this.files.spreadsheet(file);
    const id = new Types.ObjectId();
    const key = importFileKey(id.toHexString());
    await this.storage.putPrivate(key, body, XLSX_MIME);
    await this.jobs.create(id, key, userId);
    await this.queue.enqueue('import-products', { jobId: id.toHexString() });
    return id.toHexString();
  }

  /** `GET /api/admin/import-jobs/:id`. */
  async status(id: string): Promise<ImportJobDTO> {
    const job = await this.jobs.findById(id);
    if (!job) throw AppError.notFound("We couldn't find that import.");
    return toImportJobDto(job);
  }

  /** The `import-products` job. Never throws for bad data: the job record says what happened. */
  async run(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job || job.status === 'DONE' || job.status === 'FAILED') return;
    try {
      const context = await this.context(jobId, String(job.createdByUserId));
      const file = await this.storage.getPrivate(job.fileKey);
      if (!file) throw new ImportFileError('The uploaded file is missing. Upload it again.');
      const rows = await this.readRows(file.body);
      await this.jobs.start(jobId, rows.length);

      let processed = 0;
      for (const [slug, group] of this.groups(rows, context)) {
        await this.importProduct(slug, group, context);
        processed += group.length;
        await this.jobs.progress(jobId, processed);
      }

      // Rows without a product name or slug were reported while grouping; they count as processed.
      await this.jobs.finish(jobId, context.summary, context.errors, rows.length);
      await this.audit.record(context.actor, {
        action: 'products.imported',
        entity: 'importJob',
        entityId: jobId,
        after: { rows: rows.length, ...context.summary },
      });
    } catch (error) {
      if (error instanceof ImportFileError) {
        await this.jobs.fail(jobId, error.message);
        return;
      }
      this.logger.error({ err: error, jobId }, 'Product import failed');
      await this.jobs.fail(jobId, 'The import stopped unexpectedly. Rows saved before that are kept; upload the file again to finish.');
    }
  }

  /** The importer's permissions *now* (they may have changed since the upload). */
  private async context(jobId: string, userId: string): Promise<RunContext> {
    const user = await this.users.findAuthView(userId);
    if (!user || user.status !== 'active' || user.role === 'CUSTOMER') {
      throw new ImportFileError('The person who started this import can no longer make changes.');
    }
    const permissions: Permission[] = effectivePermissions({ role: user.role, permissions: user.permissions });
    const who: Who = { role: user.role, permissions };
    if (!hasPermission(who, 'products.import')) throw new ImportFileError('The person who started this import may no longer import products.');

    const [brands, categories] = await Promise.all([this.brandsRepository.findAll(), this.categoriesRepository.findAll()]);
    const brandKeys = new Map<string, string>();
    for (const brand of brands) {
      brandKeys.set(brand.name.trim().toLowerCase(), String(brand._id));
      brandKeys.set(brand.slug, String(brand._id));
    }
    return {
      jobId,
      who,
      actor: { id: String(user._id), name: user.name, role: user.role },
      brands: brandKeys,
      categories: new Map(categories.map((category) => [category.slug, String(category._id)])),
      summary: { created: 0, updated: 0, failed: 0 },
      errors: [],
    };
  }

  /** Rows of the Products sheet (or the first sheet), by the header row's column names. */
  private async readRows(body: Buffer): Promise<SheetRow[]> {
    const workbook = new ExcelJS.Workbook();
    try {
      // ExcelJS types its own Buffer; a plain ArrayBuffer copy satisfies it and loads the same.
      await workbook.xlsx.load(new Uint8Array(body).buffer);
    } catch {
      throw new ImportFileError("This file can't be opened as an Excel workbook. Save it as .xlsx and upload it again.");
    }
    const sheet = workbook.getWorksheet(PRODUCT_SHEET_NAME) ?? workbook.worksheets[0];
    if (!sheet) throw new ImportFileError('The workbook has no sheets.');

    const columns = new Map<number, ProductSheetColumn>();
    sheet.getRow(1).eachCell((cell, index) => {
      const name = cellText(cell.value).toLowerCase();
      const column = PRODUCT_SHEET_COLUMNS.find((known) => known === name);
      if (column) columns.set(index, column);
    });
    if (![...columns.values()].includes('sku')) {
      throw new ImportFileError('The first row must be the template\'s header row (the "sku" column is missing).');
    }

    const rows: SheetRow[] = [];
    sheet.eachRow((row, number) => {
      if (number === 1) return;
      const cells: SheetRow['cells'] = {};
      for (const [index, column] of columns) {
        const value = cellText(row.getCell(index).value);
        if (value) cells[column] = value;
      }
      if (Object.keys(cells).length > 0) rows.push({ row: number, cells });
    });
    if (rows.length > MAX_ROWS) throw new ImportFileError(`Import at most ${MAX_ROWS} rows at a time.`);
    return rows;
  }

  /** Rows → products by `product_slug` (or the slug of `product_name`), in sheet order. */
  private groups(rows: readonly SheetRow[], context: RunContext): Map<string, SheetRow[]> {
    const groups = new Map<string, SheetRow[]>();
    for (const row of rows) {
      const slug = text(row, 'product_slug')?.toLowerCase() ?? slugify(text(row, 'product_name') ?? '');
      if (!slug) {
        this.fail(context, row, 'Fill in product_name or product_slug.');
        continue;
      }
      const group = groups.get(slug) ?? [];
      group.push(row);
      groups.set(slug, group);
    }
    return groups;
  }

  private async importProduct(slug: string, rows: readonly SheetRow[], context: RunContext): Promise<void> {
    let product = await this.products.findBySlug(slug);
    if (product) {
      await this.updateDetails(product, rows[0], context);
    }
    const newPhotos = !product;

    for (const row of rows) {
      try {
        const sku = text(row, 'sku')?.toUpperCase();
        if (!sku) throw new RowError('sku: fill in the SKU.');
        const owner = await this.products.findBySku(sku);
        if (owner && (!product || String(owner._id) !== String(product._id))) {
          throw new RowError(`sku: ${sku} already belongs to the product "${owner.name}".`);
        }

        let saved: AdminProductDTO;
        if (!product) {
          saved = await this.createProduct(slug, row, sku, context);
          context.summary.created += 1;
        } else if (owner) {
          saved = await this.updateVariant(product, row, sku, context);
          context.summary.updated += 1;
        } else {
          saved = await this.productService.addVariant(context.who, context.actor, String(product._id), await this.newVariant(row, sku, context));
          context.summary.created += 1;
        }
        await this.applyStock(saved, row, sku, context);
        product = (await this.products.findBySlug(saved.slug)) ?? product;
      } catch (error) {
        this.fail(context, row, describe(error));
      }
    }

    if (newPhotos && product) await this.addPhotos(product, rows, context);
  }

  private async createProduct(slug: string, row: SheetRow, sku: string, context: RunContext): Promise<AdminProductDTO> {
    const brand = text(row, 'brand');
    const category = text(row, 'category_slug');
    const brandId = brand ? context.brands.get(brand.toLowerCase()) : undefined;
    const categoryId = category ? context.categories.get(category.toLowerCase()) : undefined;
    if (!brandId) throw new RowError(brand ? `brand: "${brand}" doesn't exist. Add the brand first.` : 'brand: fill in the brand.');
    if (!categoryId) throw new RowError(category ? `category_slug: "${category}" doesn't exist.` : 'category_slug: fill in the category.');
    const status = text(row, 'status');

    const input = await validated(CreateProductDto, {
      name: text(row, 'product_name'),
      slug,
      brandId,
      categoryId,
      type: text(row, 'type'),
      unit: text(row, 'unit'),
      description: text(row, 'description'),
      ...(status && { status }),
      variants: [this.newVariantPlain(row, sku, context)],
    });
    return this.productService.create(context.who, context.actor, input);
  }

  /** Product-level columns of the group's first row, where filled in and different. */
  private async updateDetails(product: ProductLean, row: SheetRow | undefined, context: RunContext): Promise<void> {
    if (!row) return;
    try {
      const brand = text(row, 'brand');
      const category = text(row, 'category_slug');
      const brandId = brand ? context.brands.get(brand.toLowerCase()) : undefined;
      const categoryId = category ? context.categories.get(category.toLowerCase()) : undefined;
      if (brand && !brandId) throw new RowError(`brand: "${brand}" doesn't exist.`);
      if (category && !categoryId) throw new RowError(`category_slug: "${category}" doesn't exist.`);

      const changes: Record<string, unknown> = {};
      const name = text(row, 'product_name');
      if (name && name !== product.name) changes.name = name;
      if (brandId && brandId !== String(product.brandId)) changes.brandId = brandId;
      if (categoryId && categoryId !== String(product.categoryId)) changes.categoryId = categoryId;
      const type = text(row, 'type');
      if (type && type !== product.type) changes.type = type;
      const unit = text(row, 'unit');
      if (unit && unit !== product.unit) changes.unit = unit;
      const description = text(row, 'description');
      if (description && description !== product.description) changes.description = description;
      if (Object.keys(changes).length > 0) {
        await this.productService.update(context.who, context.actor, String(product._id), await validated(UpdateProductDto, changes));
      }

      const status = text(row, 'status');
      if (status && status !== product.status) {
        if (status !== 'active' && status !== 'hidden') throw new RowError('status: use active or hidden.');
        await this.productService.setStatus(context.actor, String(product._id), status);
      }
    } catch (error) {
      // Product details failing doesn't stop its variant rows; this row reports it.
      this.fail(context, row, describe(error));
    }
  }

  private async updateVariant(product: ProductLean, row: SheetRow, sku: string, context: RunContext): Promise<AdminProductDTO> {
    const variant = product.variants.find((item) => item.sku === sku);
    if (!variant) throw new RowError(`sku: ${sku} wasn't found on this product.`);
    const changes: Record<string, unknown> = {};
    const label = text(row, 'variant_label');
    if (label) changes.label = label;
    const options = this.options(row);
    if (options) changes.options = options;
    const lowStockThreshold = whole(row, 'low_stock_threshold');
    if (lowStockThreshold !== undefined) changes.lowStockThreshold = lowStockThreshold;

    // Price columns only count for importers who may change prices; otherwise they're ignored (SPEC §12.3).
    if (hasPermission(context.who, 'products.edit_price')) {
      const mrp = whole(row, 'mrp');
      const price = whole(row, 'price');
      if (mrp !== undefined) changes.mrp = mrp;
      if (price !== undefined) changes.price = price;
      const sheetTiers = tiers(row);
      if (sheetTiers) {
        // The sheet has three tier pairs: when they repeat a longer ladder's first three, keep the ladder.
        const keepsLongerLadder = variant.bulkTiers.length > SHEET_TIERS && sameTiers(variant.bulkTiers.slice(0, SHEET_TIERS), sheetTiers);
        if (!keepsLongerLadder && !sameTiers(variant.bulkTiers, sheetTiers)) changes.bulkTiers = sheetTiers;
      }
    }

    if (Object.keys(changes).length === 0) return this.productService.detail(String(product._id));
    return this.productService.updateVariant(
      context.who,
      context.actor,
      String(product._id),
      String(variant._id),
      await validated(VariantUpdateInput, changes),
    );
  }

  private newVariant(row: SheetRow, sku: string, context: RunContext): Promise<VariantCreateInput> {
    return validated(VariantCreateInput, this.newVariantPlain(row, sku, context));
  }

  /** A new SKU needs prices, so it needs price permission (SPEC §12.3). Stock is applied afterwards. */
  private newVariantPlain(row: SheetRow, sku: string, context: RunContext): Record<string, unknown> {
    if (!hasPermission(context.who, 'products.edit_price')) {
      throw new RowError("sku: adding a new SKU sets its price, and you don't have price permission.");
    }
    return {
      sku,
      label: text(row, 'variant_label'),
      options: this.options(row),
      mrp: whole(row, 'mrp'),
      price: whole(row, 'price'),
      bulkTiers: tiers(row) ?? [],
      lowStockThreshold: whole(row, 'low_stock_threshold'),
    };
  }

  private options(row: SheetRow): Record<string, string> | undefined {
    const options: Record<string, string> = {};
    for (const [column, key] of OPTION_COLUMNS) {
      const value = text(row, column);
      if (value) options[key] = value;
    }
    return Object.keys(options).length > 0 ? options : undefined;
  }

  /** `stock` is the new count (SPEC §12.3); only with stock permission, as an IMPORT movement. */
  private async applyStock(product: AdminProductDTO, row: SheetRow, sku: string, context: RunContext): Promise<void> {
    const target = whole(row, 'stock');
    if (target === undefined || !hasPermission(context.who, 'products.edit_stock')) return;
    if (target < 0) throw new RowError('stock: use 0 or more.');
    const variant = product.variants.find((item) => item.sku === sku);
    if (!variant || variant.stock === target) return;
    await this.productService.adjustStock(context.actor, product.id, variant.id, target - variant.stock, `Excel import ${context.jobId}`, 'IMPORT');
  }

  /** `image_urls` of a product the import created: downloaded and processed like uploads. */
  private async addPhotos(product: ProductLean, rows: readonly SheetRow[], context: RunContext): Promise<void> {
    const urls = [...new Set(rows.flatMap((row) => (text(row, 'image_urls') ?? '').split(',').map((url) => url.trim()).filter(Boolean)))];
    if (urls.length === 0) return;
    const firstRow = rows.find((row) => text(row, 'image_urls')) ?? rows[0];
    const keys: string[] = [];
    for (const url of urls.slice(0, MAX_PRODUCT_IMAGES)) {
      try {
        const sizes = await this.files.productImageFromBytes(await downloadImage(url));
        const prefix = productImagePrefix(String(product._id), new Types.ObjectId().toHexString());
        await Promise.all([...sizes].map(([width, body]) => this.storage.putPublic(productImageFileKey(prefix, width), body, 'image/webp')));
        keys.push(prefix);
      } catch (error) {
        if (firstRow) this.warn(context, firstRow, `Photo not added: ${error instanceof Error ? error.message : url}`);
      }
    }
    if (keys.length === 0) return;
    try {
      const images = await validated(UpdateProductDto, { images: keys.map((key) => ({ key, alt: product.name })) });
      await this.productService.update(context.who, context.actor, String(product._id), images);
    } catch (error) {
      if (firstRow) this.warn(context, firstRow, `Photos not added: ${describe(error)}`);
    }
  }

  private fail(context: RunContext, row: SheetRow, message: string): void {
    context.summary.failed += 1;
    context.errors.push({ row: row.row, sku: text(row, 'sku')?.toUpperCase(), message });
  }

  /** Reported, but the row itself was saved. */
  private warn(context: RunContext, row: SheetRow, message: string): void {
    context.errors.push({ row: row.row, sku: text(row, 'sku')?.toUpperCase(), message });
  }
}
