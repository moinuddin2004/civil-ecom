import { escapeRegExp, type ProductStatus } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types, type ClientSession, type Model, type PipelineStage } from 'mongoose';
import { Paginated } from '../../common/http/envelope.js';
import { BaseRepository } from '../../database/base.repository.js';
import { Product, type ProductLean, type Variant } from '../../models/product.model.js';

const { trusted } = mongoose;

export interface AdminProductFilters {
  q?: string;
  categoryId?: string;
  brandId?: string;
  /** Default: active and hidden (archived products are left out of the default list, SPEC §6.12). */
  status?: ProductStatus | 'all';
  lowStock?: boolean;
}

export interface AdminProductSort {
  field: 'updatedAt' | 'createdAt' | 'name' | 'minPrice' | 'totalStock';
  direction: 'asc' | 'desc';
}

export type AdminProductRow = Pick<
  ProductLean,
  '_id' | 'slug' | 'name' | 'brandName' | 'categoryId' | 'minPrice' | 'maxPrice' | 'totalStock' | 'status' | 'updatedAt'
> & {
  images: { key: string }[];
  hasLowStock: boolean;
};

/** "An active variant at or below its threshold" (SPEC §6.10 `isLowStock`), as an aggregation expression. */
const HAS_LOW_STOCK = {
  $anyElementTrue: {
    $map: {
      input: '$variants',
      as: 'v',
      in: { $and: ['$$v.isActive', { $lte: ['$$v.stock', '$$v.lowStockThreshold'] }] },
    },
  },
};

/** Fields an admin may change on a product (not status, not stock). */
export type ProductDetailChanges = Partial<
  Pick<
    Product,
    | 'name'
    | 'slug'
    | 'brandId'
    | 'categoryId'
    | 'type'
    | 'unit'
    | 'description'
    | 'specifications'
    | 'images'
    | 'isFeatured'
    | 'relatedProductIds'
    | 'seo'
    | 'status'
  >
>;

export type VariantChanges = Partial<
  Pick<Variant, 'sku' | 'label' | 'options' | 'mrp' | 'price' | 'bulkTiers' | 'lowStockThreshold' | 'isActive'>
>;

/**
 * Admin product reads and writes (SPEC §7.3). Writes load and `save()` the document, so the model's
 * pricing rules (§6.1), derived fields, `categoryPath` and `brandName` are always recomputed. Stock is
 * never written here — only through `ProductStockRepository`.
 */
@Injectable()
export class AdminProductsRepository extends BaseRepository<Product, ProductLean> {
  constructor(@InjectModel(Product.name) model: Model<Product>) {
    super(model);
  }

  async list(filters: AdminProductFilters, page: number, pageSize: number, sort: AdminProductSort): Promise<Paginated<AdminProductRow>> {
    const direction = sort.direction === 'asc' ? 1 : -1;
    const pipeline: PipelineStage[] = [
      { $match: this.match(filters) },
      ...(filters.lowStock ? [{ $match: { $expr: HAS_LOW_STOCK } }] : []),
      {
        $facet: {
          rows: [
            { $sort: { [sort.field]: direction, _id: direction } },
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize },
            {
              $project: {
                slug: 1,
                name: 1,
                brandName: 1,
                categoryId: 1,
                minPrice: 1,
                maxPrice: 1,
                totalStock: 1,
                status: 1,
                updatedAt: 1,
                images: { $slice: ['$images', 1] },
                hasLowStock: HAS_LOW_STOCK,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ];
    const [result] = await this.model.aggregate<{ rows: AdminProductRow[]; total: { count: number }[] }>(pipeline).exec();
    return new Paginated(result?.rows ?? [], { page, pageSize, total: result?.total[0]?.count ?? 0 });
  }

  /** SKUs from `skus` already used by another product (the unique index would refuse them). */
  async takenSkus(skus: readonly string[], exceptProductId?: Types.ObjectId): Promise<string[]> {
    if (skus.length === 0) return [];
    const wanted = new Set(skus);
    const products = await this.model
      .find(
        { 'variants.sku': trusted({ $in: [...wanted] }), ...(exceptProductId && { _id: trusted({ $ne: exceptProductId }) }) },
        { 'variants.sku': 1 },
      )
      .lean<{ variants: { sku: string }[] }[]>()
      .exec();
    return products.flatMap((product) => product.variants.map((variant) => variant.sku)).filter((sku) => wanted.has(sku));
  }

  slugTaken(slug: string, exceptId?: Types.ObjectId): Promise<boolean> {
    return this.exists({ slug, ...(exceptId && { _id: trusted({ $ne: exceptId }) }) });
  }

  async create(input: Partial<Product> & { _id: Types.ObjectId }, session: ClientSession): Promise<ProductLean> {
    const [created] = await this.model.create([input], { session });
    if (!created) throw new Error('The product was not created.');
    return created.toObject<ProductLean>();
  }

  /**
   * Applies detail changes, per-variant changes and new variants in one `save()`. Unknown variant ids
   * return null for the caller to answer 404.
   */
  async applyChanges(
    id: Types.ObjectId,
    changes: { details?: ProductDetailChanges; variants?: { id: string; changes: VariantChanges }[]; newVariants?: Variant[] },
    session: ClientSession,
  ): Promise<ProductLean | null> {
    const doc = await this.model.findById(id).session(session).exec();
    if (!doc) return null;
    if (changes.details) doc.set(changes.details);
    for (const { id: variantId, changes: variantChanges } of changes.variants ?? []) {
      const variant = doc.variants.find((item) => String(item._id) === variantId);
      if (!variant) return null;
      Object.assign(variant, variantChanges);
    }
    for (const variant of changes.newVariants ?? []) doc.variants.push(variant);
    await doc.save({ session });
    return doc.toObject<ProductLean>();
  }

  /** Import: the product with this slug, any status. */
  findBySlug(slug: string): Promise<ProductLean | null> {
    return this.model.findOne({ slug }).lean<ProductLean>().exec();
  }

  /** Import: the product that holds this SKU, if any (SKUs are unique across products). */
  findBySku(sku: string): Promise<ProductLean | null> {
    return this.model.findOne({ 'variants.sku': sku }).lean<ProductLean>().exec();
  }

  /** Every product matching the list filters, by name, streamed (Excel export, SPEC §7.3). */
  exportCursor(filters: AdminProductFilters): AsyncIterable<ProductLean> {
    return this.model
      .aggregate<ProductLean>([
        { $match: this.match(filters) },
        ...(filters.lowStock ? [{ $match: { $expr: HAS_LOW_STOCK } }] : []),
        { $sort: { name: 1, _id: 1 } },
      ])
      .cursor();
  }

  private match(filters: AdminProductFilters): Record<string, unknown> {
    const match: Record<string, unknown> = {};
    if (!filters.status) match.status = { $in: ['active', 'hidden'] };
    else if (filters.status !== 'all') match.status = filters.status;
    if (filters.categoryId) match.categoryPath = new Types.ObjectId(filters.categoryId);
    if (filters.brandId) match.brandId = new Types.ObjectId(filters.brandId);
    const q = filters.q?.trim();
    if (q) {
      const contains = new RegExp(escapeRegExp(q), 'i');
      match.$or = [{ name: contains }, { brandName: contains }, { 'variants.sku': new RegExp(escapeRegExp(q.toUpperCase())) }];
    }
    return match;
  }
}
