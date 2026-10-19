import {
  CACHE_TAGS,
  hasPermission,
  PRICE_FIELDS,
  slugify,
  type AdminProductDTO,
  type AdminProductListItemDTO,
  type Permission,
  type ProductStatus,
} from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { isDuplicateKey } from '../../common/errors/mongo-errors.js';
import { Paginated } from '../../common/http/envelope.js';
import { TransactionService } from '../../database/transaction.service.js';
import type { ProductLean, Variant } from '../../models/product.model.js';
import { AuditService, changedFields, snapshot, type AuditActor } from '../audit/audit.service.js';
import type { Principal } from '../auth/auth.types.js';
import { BrandsRepository, CategoriesRepository } from '../catalog/catalog.repositories.js';
import { ProductStockRepository, type MovementInput } from '../inventory/product-stock.repository.js';
import { REVALIDATE_STOCK_MS, RevalidationService } from '../revalidation/revalidation.service.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  AdminProductsRepository,
  type AdminProductFilters,
  type AdminProductRow,
  type AdminProductSort,
  type ProductDetailChanges,
  type VariantChanges,
} from './admin-products.repository.js';
import {
  VariantPatchInput,
  type CreateProductDto,
  type UpdateProductDto,
  type VariantCreateInput,
  type VariantOptionsInput,
  type VariantUpdateInput,
} from './dto/admin-products.dto.js';

const PRODUCT_NOT_FOUND = "We couldn't find that product.";
const DETAIL_FIELDS = [
  'name',
  'slug',
  'brandId',
  'categoryId',
  'type',
  'unit',
  'description',
  'specifications',
  'images',
  'isFeatured',
  'relatedProductIds',
  'seo',
] as const;

type Who = Pick<Principal, 'role' | 'permissions'>;

const fieldError = (path: string, message: string) => AppError.validation(message, [{ path, message }]);
const forbidden = (message: string) => AppError.forbidden(message);
const can = (who: Who, permission: Permission) => hasPermission({ role: who.role, permissions: who.permissions }, permission);

function cleanOptions(options: VariantOptionsInput | undefined): Variant['options'] {
  if (!options) return {};
  const out: Variant['options'] = {};
  if (options.packSize) out.packSize = options.packSize;
  if (options.grade) out.grade = options.grade;
  if (options.colour) out.colour = options.colour;
  if (options.size) out.size = options.size;
  return out;
}

function toListItem(row: AdminProductRow, categoryNames: ReadonlyMap<string, string>): AdminProductListItemDTO {
  return {
    id: String(row._id),
    slug: row.slug,
    name: row.name,
    imageKey: row.images[0]?.key ?? null,
    brandName: row.brandName,
    categoryName: categoryNames.get(String(row.categoryId)) ?? '',
    minPrice: row.minPrice,
    maxPrice: row.maxPrice,
    totalStock: row.totalStock,
    hasLowStock: row.hasLowStock,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAdminProductDto(product: ProductLean): AdminProductDTO {
  return {
    id: String(product._id),
    slug: product.slug,
    name: product.name,
    brandId: String(product.brandId),
    brandName: product.brandName,
    categoryId: String(product.categoryId),
    type: product.type ?? null,
    unit: product.unit,
    description: product.description,
    specifications: product.specifications.map(({ label, value }) => ({ label, value })),
    images: product.images.map((image) => ({ id: String(image._id), key: image.key, alt: image.alt })),
    variants: product.variants.map((variant) => ({
      id: String(variant._id),
      sku: variant.sku,
      label: variant.label,
      options: cleanOptions(variant.options),
      mrp: variant.mrp,
      price: variant.price,
      bulkTiers: variant.bulkTiers.map(({ minQty, price }) => ({ minQty, price })),
      stock: variant.stock,
      lowStockThreshold: variant.lowStockThreshold,
      isActive: variant.isActive,
      isLowStock: variant.stock <= variant.lowStockThreshold,
    })),
    isFeatured: product.isFeatured,
    relatedProductIds: product.relatedProductIds.map(String),
    seo: { title: product.seo.title ?? null, description: product.seo.description ?? null },
    status: product.status,
    minPrice: product.minPrice,
    maxPrice: product.maxPrice,
    totalStock: product.totalStock,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

/** What changed in the price fields of each variant (for the permission check and the audit). */
function priceChanges(before: ProductLean, after: ProductLean): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const was: Record<string, unknown> = {};
  const now: Record<string, unknown> = {};
  for (const variant of after.variants) {
    const old = before.variants.find((item) => String(item._id) === String(variant._id));
    if (!old) continue;
    const diff = changedFields(old, variant, PRICE_FIELDS);
    if (Object.keys(diff.after).length > 0) {
      was[variant.sku] = diff.before;
      now[variant.sku] = diff.after;
    }
  }
  return { before: was, after: now };
}

/**
 * Products and stock for the admin panel (SPEC §7.3 "Products and stock", §6.10, CLAUDE.md §27):
 * price fields need `products.edit_price` and stock needs `products.edit_stock`, enforced here
 * whatever the UI shows. Every write is audited in its transaction and refreshes the storefront.
 */
@Injectable()
export class AdminProductsService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly products: AdminProductsRepository,
    private readonly categories: CategoriesRepository,
    private readonly brands: BrandsRepository,
    private readonly stock: ProductStockRepository,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly revalidation: RevalidationService,
  ) {}

  async list(filters: AdminProductFilters, page: number, pageSize: number, sort: AdminProductSort): Promise<Paginated<AdminProductListItemDTO>> {
    const [result, categories] = await Promise.all([this.products.list(filters, page, pageSize, sort), this.categories.findAll()]);
    const names = new Map(categories.map((category) => [String(category._id), category.name]));
    return new Paginated(
      result.data.map((row) => toListItem(row, names)),
      result.meta,
    );
  }

  async detail(id: string): Promise<AdminProductDTO> {
    const product = await this.products.findById(id);
    if (!product) throw AppError.notFound(PRODUCT_NOT_FOUND);
    return toAdminProductDto(product);
  }

  async create(who: Who, actor: AuditActor, input: CreateProductDto): Promise<AdminProductDTO> {
    const id = new Types.ObjectId(input.id);
    if (input.variants.some((variant) => (variant.stock ?? 0) > 0) && !can(who, 'products.edit_stock')) {
      throw forbidden("You can't set stock. Leave it at 0, or ask someone who can adjust stock.");
    }
    this.assertImagesBelongTo(input.images?.map((image) => image.key) ?? [], id);
    this.assertUniqueSkus(input.variants.map((variant) => variant.sku));
    const slug = input.slug ?? slugify(input.name);
    if (!slug) throw fieldError('slug', 'Enter a URL name using letters or numbers.');

    const { lowStockDefault } = await this.settings.get();
    const status: ProductStatus = input.status ?? 'hidden';
    const variants: Variant[] = input.variants.map((variant) => this.newVariant(variant, lowStockDefault));

    const product = await this.write(() =>
      this.transactions.run(async (session) => {
        await this.assertFree(slug, variants.map((variant) => variant.sku));
        if (status === 'active') await this.assertCanBeActive(input.brandId, input.categoryId, session);
        const created = await this.products.create(
          {
            _id: id,
            name: input.name,
            slug,
            brandId: new Types.ObjectId(input.brandId),
            categoryId: new Types.ObjectId(input.categoryId),
            type: input.type,
            unit: input.unit,
            description: input.description ?? '',
            specifications: (input.specifications ?? []).map(({ label, value }) => ({ label, value })),
            images: (input.images ?? []).map((image) => ({ _id: new Types.ObjectId(), key: image.key, alt: image.alt ?? '' })),
            isFeatured: input.isFeatured ?? false,
            relatedProductIds: (input.relatedProductIds ?? []).filter((related) => related !== String(id)).map((related) => new Types.ObjectId(related)),
            seo: { title: input.seo?.title, description: input.seo?.description },
            status,
            variants,
          },
          session,
        );
        await this.recordInitialStock(created, created.variants, actor, session);
        await this.audit.record(
          actor,
          {
            action: 'product.created',
            entity: 'product',
            entityId: String(id),
            after: {
              ...snapshot(created, ['name', 'slug', 'brandId', 'categoryId', 'unit', 'status']),
              variants: created.variants.map((variant) => snapshot(variant, ['sku', 'label', 'mrp', 'price', 'bulkTiers', 'stock'])),
            },
          },
          session,
        );
        return created;
      }),
    );

    this.revalidateProduct(product.slug);
    return toAdminProductDto(product);
  }

  /** Details plus per-variant changes; any price change needs `products.edit_price` (CLAUDE.md §27). */
  async update(who: Who, actor: AuditActor, id: string, input: UpdateProductDto): Promise<AdminProductDTO> {
    const details: ProductDetailChanges = {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.brandId !== undefined && { brandId: new Types.ObjectId(input.brandId) }),
      ...(input.categoryId !== undefined && { categoryId: new Types.ObjectId(input.categoryId) }),
      ...(input.type !== undefined && { type: input.type ?? undefined }),
      ...(input.unit !== undefined && { unit: input.unit }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.specifications !== undefined && { specifications: input.specifications.map(({ label, value }) => ({ label, value })) }),
      ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
      ...(input.seo !== undefined && { seo: { title: input.seo.title, description: input.seo.description } }),
    };
    if (input.images) {
      this.assertImagesBelongTo(
        input.images.map((image) => image.key),
        new Types.ObjectId(id),
      );
    }
    if (input.relatedProductIds?.includes(id)) throw fieldError('relatedProductIds', "A product can't be related to itself.");

    const { before, after } = await this.write(() =>
      this.transactions.run(async (session) => {
        const current = await this.products.findById(id, session);
        if (!current) throw AppError.notFound(PRODUCT_NOT_FOUND);
        if (input.images) {
          // Keep each image's id when its key is unchanged (stable ids for the gallery order).
          const idByKey = new Map(current.images.map((image) => [image.key, image._id]));
          details.images = input.images.map((image) => ({ _id: idByKey.get(image.key) ?? new Types.ObjectId(), key: image.key, alt: image.alt ?? '' }));
        }
        if (input.relatedProductIds) details.relatedProductIds = input.relatedProductIds.map((related) => new Types.ObjectId(related));

        const variantChanges = (input.variants ?? []).map((variant) => ({ id: variant.id, changes: this.variantChanges(variant) }));
        this.assertMayChangePrices(who, current, variantChanges);
        this.assertUniqueSkus(current.variants.map((variant) => {
          const changed = variantChanges.find((item) => item.id === String(variant._id));
          return changed?.changes.sku ?? variant.sku;
        }));
        await this.assertFree(
          details.slug,
          variantChanges.flatMap((item) => (item.changes.sku ? [item.changes.sku] : [])),
          current._id,
        );
        if (current.status === 'active' && (details.brandId || details.categoryId)) {
          await this.assertCanBeActive(String(details.brandId ?? current.brandId), String(details.categoryId ?? current.categoryId), session);
        }

        const updated = await this.products.applyChanges(current._id, { details, variants: variantChanges }, session);
        if (!updated) throw AppError.notFound("We couldn't find that product or one of its variants.");
        await this.auditUpdate(actor, current, updated, session);
        return { before: current, after: updated };
      }),
    );

    this.revalidateProduct(before.slug, after.slug);
    return toAdminProductDto(after);
  }

  /** `POST /:id/variants` needs `products.edit` + `products.edit_price`; stock needs `products.edit_stock`. */
  async addVariant(who: Who, actor: AuditActor, id: string, input: VariantCreateInput): Promise<AdminProductDTO> {
    if ((input.stock ?? 0) > 0 && !can(who, 'products.edit_stock')) {
      throw forbidden("You can't set stock. Leave it at 0, or ask someone who can adjust stock.");
    }
    const { lowStockDefault } = await this.settings.get();
    const variant = this.newVariant(input, lowStockDefault);

    const product = await this.write(() =>
      this.transactions.run(async (session) => {
        const current = await this.products.findById(id, session);
        if (!current) throw AppError.notFound(PRODUCT_NOT_FOUND);
        if (current.variants.some((item) => item.sku === variant.sku)) throw this.skuTaken(variant.sku);
        await this.assertFree(undefined, [variant.sku], current._id);
        const updated = await this.products.applyChanges(current._id, { newVariants: [variant] }, session);
        if (!updated) throw AppError.notFound(PRODUCT_NOT_FOUND);
        const added = updated.variants.filter((item) => String(item._id) === String(variant._id));
        await this.recordInitialStock(updated, added, actor, session);
        await this.audit.record(
          actor,
          {
            action: 'product.variant_added',
            entity: 'product',
            entityId: id,
            after: { variant: snapshot(variant, ['sku', 'label', 'options', 'mrp', 'price', 'bulkTiers', 'stock', 'isActive']) },
          },
          session,
        );
        return updated;
      }),
    );
    this.revalidateProduct(product.slug);
    return toAdminProductDto(product);
  }

  async updateVariant(who: Who, actor: AuditActor, id: string, variantId: string, input: VariantUpdateInput): Promise<AdminProductDTO> {
    // The single-variant endpoint is the product PATCH with one variant change.
    const patch = Object.assign(new VariantPatchInput(), input, { id: variantId });
    return this.update(who, actor, id, { variants: [patch] });
  }

  /**
   * SPEC §6.10 manual adjustment: atomic, never below 0, with a movement and an audit entry. The
   * Excel import uses it too, with movement reason `IMPORT` (SPEC §12.3).
   */
  async adjustStock(
    actor: AuditActor,
    id: string,
    variantId: string,
    change: number,
    reason: string,
    movementReason: 'ADJUST' | 'IMPORT' = 'ADJUST',
  ): Promise<AdminProductDTO> {
    if (change === 0) throw fieldError('change', 'Enter a change other than 0.');
    const product = await this.transactions.run(async (session) => {
      const current = await this.products.findById(id, session);
      if (!current) throw AppError.notFound(PRODUCT_NOT_FOUND);
      const variant = current.variants.find((item) => String(item._id) === variantId);
      if (!variant) throw AppError.notFound("We couldn't find that variant.");

      const stockAfter = await this.stock.adjust(current._id, variant._id, change, session);
      if (stockAfter === null) {
        throw fieldError('change', `Only ${variant.stock} in stock; you can remove at most ${variant.stock}.`);
      }
      await this.stock.recomputeTotals([current._id], session);
      const movement: MovementInput = {
        line: { productId: current._id, variantId: variant._id, sku: variant.sku, qty: Math.abs(change) },
        change,
        stockAfter,
        reason: movementReason,
        note: reason,
        byUserId: new Types.ObjectId(actor.id),
        at: new Date(),
      };
      await this.stock.recordMovements([movement], session);
      await this.audit.record(
        actor,
        {
          action: 'stock.adjusted',
          entity: 'product',
          entityId: id,
          before: { sku: variant.sku, stock: variant.stock },
          after: { sku: variant.sku, stock: stockAfter, change, reason },
        },
        session,
      );
      return this.products.findById(id, session);
    });
    if (!product) throw AppError.notFound(PRODUCT_NOT_FOUND);
    this.revalidation.revalidate([CACHE_TAGS.catalog, CACHE_TAGS.product(product.slug)], REVALIDATE_STOCK_MS);
    return toAdminProductDto(product);
  }

  /** `products.archive`. An active product needs an active brand and category (SPEC §6.12). */
  async setStatus(actor: AuditActor, id: string, status: ProductStatus): Promise<AdminProductDTO> {
    const product = await this.transactions.run(async (session) => {
      const current = await this.products.findById(id, session);
      if (!current) throw AppError.notFound(PRODUCT_NOT_FOUND);
      if (current.status === status) return current;
      if (status === 'active') await this.assertCanBeActive(String(current.brandId), String(current.categoryId), session);
      const updated = await this.products.applyChanges(current._id, { details: { status } }, session);
      if (!updated) throw AppError.notFound(PRODUCT_NOT_FOUND);
      await this.audit.record(
        actor,
        { action: 'product.status_changed', entity: 'product', entityId: id, before: { status: current.status }, after: { status } },
        session,
      );
      return updated;
    });
    this.revalidateProduct(product.slug);
    return toAdminProductDto(product);
  }

  /* Helpers */

  private newVariant(input: VariantCreateInput, lowStockDefault: number): Variant {
    return {
      _id: new Types.ObjectId(),
      sku: input.sku,
      label: input.label,
      options: cleanOptions(input.options),
      mrp: input.mrp,
      price: input.price,
      bulkTiers: (input.bulkTiers ?? []).map(({ minQty, price }) => ({ minQty, price })),
      stock: input.stock ?? 0,
      lowStockThreshold: input.lowStockThreshold ?? lowStockDefault,
      isActive: input.isActive ?? true,
    };
  }

  private variantChanges(input: VariantUpdateInput): VariantChanges {
    return {
      ...(input.sku !== undefined && { sku: input.sku }),
      ...(input.label !== undefined && { label: input.label }),
      ...(input.options !== undefined && { options: cleanOptions(input.options) }),
      ...(input.mrp !== undefined && { mrp: input.mrp }),
      ...(input.price !== undefined && { price: input.price }),
      ...(input.bulkTiers !== undefined && { bulkTiers: input.bulkTiers.map(({ minQty, price }) => ({ minQty, price })) }),
      ...(input.lowStockThreshold !== undefined && { lowStockThreshold: input.lowStockThreshold }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    };
  }

  /**
   * CLAUDE.md §27: any change to `mrp`, `price` or `bulkTiers` needs `products.edit_price` — checked
   * against the current values before anything is validated or saved, so the answer is always 403.
   */
  private assertMayChangePrices(who: Who, current: ProductLean, changes: readonly { id: string; changes: VariantChanges }[]): void {
    if (can(who, 'products.edit_price')) return;
    for (const { id, changes: change } of changes) {
      const variant = current.variants.find((item) => String(item._id) === id);
      if (!variant) continue;
      const tiers = (list: readonly { minQty: number; price: number }[]) => list.map(({ minQty, price }) => ({ minQty, price }));
      const was = { mrp: variant.mrp, price: variant.price, bulkTiers: tiers(variant.bulkTiers) };
      const proposed = { mrp: change.mrp ?? was.mrp, price: change.price ?? was.price, bulkTiers: tiers(change.bulkTiers ?? was.bulkTiers) };
      if (Object.keys(changedFields(was, proposed, PRICE_FIELDS).after).length > 0) {
        throw forbidden("You can't change prices. Ask someone with price permission.");
      }
    }
  }

  /** Price changes are audited as `product.price_changed`, everything else as `product.updated`. */
  private async auditUpdate(actor: AuditActor, before: ProductLean, after: ProductLean, session: ClientSession): Promise<void> {
    const prices = priceChanges(before, after);
    if (Object.keys(prices.after).length > 0) {
      await this.audit.record(actor, { action: 'product.price_changed', entity: 'product', entityId: String(after._id), ...prices }, session);
    }

    const details = changedFields(before, after, DETAIL_FIELDS);
    const variantFields = ['sku', 'label', 'options', 'lowStockThreshold', 'isActive'] as const;
    const variantsBefore: Record<string, unknown> = {};
    const variantsAfter: Record<string, unknown> = {};
    for (const variant of after.variants) {
      const old = before.variants.find((item) => String(item._id) === String(variant._id));
      if (!old) continue;
      const diff = changedFields(old, variant, variantFields);
      if (Object.keys(diff.after).length > 0) {
        variantsBefore[String(variant._id)] = diff.before;
        variantsAfter[String(variant._id)] = diff.after;
      }
    }
    if (Object.keys(variantsAfter).length > 0) {
      details.before.variants = variantsBefore;
      details.after.variants = variantsAfter;
    }
    if (Object.keys(details.after).length > 0) {
      await this.audit.record(actor, { action: 'product.updated', entity: 'product', entityId: String(after._id), ...details }, session);
    }
  }

  /** Initial stock is a stock change like any other: it gets an `ADJUST` movement (SPEC §6.10). */
  private async recordInitialStock(product: ProductLean, variants: readonly Variant[], actor: AuditActor, session: ClientSession): Promise<void> {
    const now = new Date();
    const movements: MovementInput[] = variants
      .filter((variant) => variant.stock > 0)
      .map((variant) => ({
        line: { productId: product._id, variantId: variant._id, sku: variant.sku, qty: variant.stock },
        change: variant.stock,
        stockAfter: variant.stock,
        reason: 'ADJUST',
        note: 'Initial stock',
        byUserId: new Types.ObjectId(actor.id),
        at: now,
      }));
    await this.stock.recordMovements(movements, session);
  }

  /** Slug and SKUs free (checked first for a clear message; the unique indexes are the final guard). */
  private async assertFree(slug: string | undefined, skus: readonly string[], productId?: Types.ObjectId): Promise<void> {
    if (slug && (await this.products.slugTaken(slug, productId))) {
      throw AppError.conflict('Another product already uses this URL name.', [{ path: 'slug', message: 'Another product already uses this URL name.' }]);
    }
    const [taken] = await this.products.takenSkus(skus, productId);
    if (taken) throw this.skuTaken(taken);
  }

  private assertUniqueSkus(skus: readonly string[]): void {
    const seen = new Set<string>();
    for (const sku of skus) {
      if (seen.has(sku)) throw fieldError('variants', `SKU ${sku} is used twice. Each SKU must be unique.`);
      seen.add(sku);
    }
  }

  private skuTaken(sku: string): AppError {
    return AppError.conflict(`SKU ${sku} is already used by another variant.`, [{ path: 'variants', message: `SKU ${sku} is already used.` }]);
  }

  /** Upload keys are `products/{productId}/{imageId}`: they must be this product's. */
  private assertImagesBelongTo(keys: readonly string[], id: Types.ObjectId): void {
    const index = keys.findIndex((key) => !key.startsWith(`products/${String(id)}/`));
    if (index >= 0) throw fieldError(`images.${index}.key`, 'This image was uploaded for another product. Upload it again.');
  }

  /** An active product must have an active brand and category, else they could never be hidden (SPEC §6.12). */
  private async assertCanBeActive(brandId: string, categoryId: string, session: ClientSession): Promise<void> {
    const brand = await this.brands.findById(brandId, session);
    const category = await this.categories.findById(categoryId, session);
    if (!brand) throw fieldError('brandId', 'Choose a brand that exists.');
    if (!category) throw fieldError('categoryId', 'Choose a category that exists.');
    if (brand.status !== 'active' || category.status !== 'active') {
      throw AppError.conflict('Show the brand and category first: an active product needs both to be active.');
    }
  }

  private revalidateProduct(...slugs: string[]): void {
    this.revalidation.revalidate([...new Set(slugs)].map(CACHE_TAGS.product).concat(CACHE_TAGS.catalog, CACHE_TAGS.home));
  }

  /** Unique-index races (slug or SKU taken between our check and the save) are still 409s. */
  private async write<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isDuplicateKey(error, 'slug')) throw AppError.conflict('Another product already uses this URL name.');
      if (isDuplicateKey(error, 'variants.sku')) throw AppError.conflict('One of these SKUs is already used by another variant.');
      throw error;
    }
  }
}
