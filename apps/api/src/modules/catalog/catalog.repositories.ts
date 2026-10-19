import { escapeRegExp, type FilterKey } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types, type ClientSession, type Model } from 'mongoose';
import { BaseRepository } from '../../database/base.repository.js';
import { Brand, type BrandLean } from '../../models/brand.model.js';
import { Category, type CategoryLean } from '../../models/category.model.js';
import { Homepage, HOMEPAGE_ID, type HomepageLean } from '../../models/homepage.model.js';
import { Product, type ProductLean } from '../../models/product.model.js';
import type { CardSource, SuggestSource } from './catalog.mappers.js';
import { CARD_PROJECTION, listingPipeline, type ListingCriteria } from './listing-query.js';

const { trusted } = mongoose;

/** Card fields for `find()` queries (the aggregation has its own `$project`). */
const CARD_FIELDS = { ...CARD_PROJECTION, images: { $slice: 1 } } as const;

const SUGGEST_FIELDS = { slug: 1, name: 1, brandName: 1, images: { $slice: 1 }, minPrice: 1, unit: 1 } as const;

const DISPLAY_ORDER = { sortOrder: 1, name: 1 } as const;

/** Case-insensitive "contains" match for search-as-you-type (`$text` needs whole words). */
const contains = (text: string) => new RegExp(escapeRegExp(text), 'i');

@Injectable()
export class CategoriesRepository extends BaseRepository<Category, CategoryLean> {
  constructor(@InjectModel(Category.name) model: Model<Category>) {
    super(model);
  }

  /** Every active category, parents and children, in display order. */
  findActive(): Promise<CategoryLean[]> {
    return this.model.find({ status: 'active' }).sort(DISPLAY_ORDER).lean<CategoryLean[]>().exec();
  }

  findActiveBySlug(slug: string): Promise<CategoryLean | null> {
    return this.findOne({ slug, status: 'active' });
  }

  searchActiveByName(text: string, limit: number): Promise<CategoryLean[]> {
    return this.model
      .find({ status: 'active', name: contains(text) })
      .sort(DISPLAY_ORDER)
      .limit(limit)
      .lean<CategoryLean[]>()
      .exec();
  }

  /** Admin: every category, hidden ones included. */
  findAll(): Promise<CategoryLean[]> {
    return this.model.find().sort(DISPLAY_ORDER).lean<CategoryLean[]>().exec();
  }

  slugTaken(slug: string, exceptId?: string): Promise<boolean> {
    return this.exists(exceptId ? { slug, _id: trusted({ $ne: new Types.ObjectId(exceptId) }) } : { slug });
  }

  async hasChildren(id: string, session?: ClientSession): Promise<boolean> {
    const child = await this.model.exists({ parentId: new Types.ObjectId(id) }).session(session ?? null).exec();
    return child !== null;
  }

  async create(input: Partial<Category> & { _id: Types.ObjectId }, session?: ClientSession): Promise<CategoryLean> {
    const [created] = await this.model.create([input], { session });
    if (!created) throw new Error('The category was not created.');
    return created.toObject<CategoryLean>();
  }
}

@Injectable()
export class BrandsRepository extends BaseRepository<Brand, BrandLean> {
  constructor(@InjectModel(Brand.name) model: Model<Brand>) {
    super(model);
  }

  findActive(): Promise<BrandLean[]> {
    return this.model.find({ status: 'active' }).sort(DISPLAY_ORDER).lean<BrandLean[]>().exec();
  }

  async findActiveBySlugs(slugs: readonly string[]): Promise<BrandLean[]> {
    if (slugs.length === 0) return [];
    return this.model
      .find({ status: 'active', slug: trusted({ $in: [...slugs] }) })
      .lean<BrandLean[]>()
      .exec();
  }

  async findActiveByIds(ids: readonly Types.ObjectId[]): Promise<BrandLean[]> {
    if (ids.length === 0) return [];
    return this.model
      .find({ _id: trusted({ $in: [...ids] }), status: 'active' })
      .lean<BrandLean[]>()
      .exec();
  }

  searchActiveByName(text: string, limit: number): Promise<BrandLean[]> {
    return this.model
      .find({ status: 'active', name: contains(text) })
      .sort(DISPLAY_ORDER)
      .limit(limit)
      .lean<BrandLean[]>()
      .exec();
  }

  /** Admin: every brand, hidden ones included. */
  findAll(): Promise<BrandLean[]> {
    return this.model.find().sort(DISPLAY_ORDER).lean<BrandLean[]>().exec();
  }

  slugTaken(slug: string, exceptId?: string): Promise<boolean> {
    return this.exists(exceptId ? { slug, _id: trusted({ $ne: new Types.ObjectId(exceptId) }) } : { slug });
  }

  async create(input: Partial<Brand> & { _id: Types.ObjectId }, session?: ClientSession): Promise<BrandLean> {
    const [created] = await this.model.create([input], { session });
    if (!created) throw new Error('The brand was not created.');
    return created.toObject<BrandLean>();
  }
}

export interface ListingFacetRow {
  _id: string;
  count: number;
}

/** The single document the listing `$facet` aggregation returns. */
export interface ListingResult {
  results: CardSource[];
  total: { count: number }[];
  brands: { _id: Types.ObjectId; count: number }[];
  price: { min: number; max: number }[];
  type: ListingFacetRow[];
  packSize: ListingFacetRow[];
  grade: ListingFacetRow[];
  colour: ListingFacetRow[];
  size: ListingFacetRow[];
}

export type FacetRows = Pick<ListingResult, FilterKey>;

export type ProductRelations = Pick<ProductLean, '_id' | 'categoryId' | 'relatedProductIds'>;

export type ProductSummary = Pick<ProductLean, '_id' | 'name' | 'status'> & { images: { key: string }[] };

/** Read side of the catalog: only `status: 'active'` products ever leave this repository. */
@Injectable()
export class CatalogProductsRepository extends BaseRepository<Product, ProductLean> {
  constructor(@InjectModel(Product.name) model: Model<Product>) {
    super(model);
  }

  /** The listing page, total and facets in one round trip (see `listing-query.ts`). */
  async listing(criteria: ListingCriteria): Promise<ListingResult> {
    const [result] = await this.model.aggregate<ListingResult>(listingPipeline(criteria)).exec();
    if (!result) throw new Error('The listing aggregation returned no document.');
    return result;
  }

  findActiveBySlug(slug: string): Promise<ProductLean | null> {
    return this.findOne({ slug, status: 'active' });
  }

  /** Just what `GET /api/products/:slug/related` needs to pick related products. */
  findActiveRelationsBySlug(slug: string): Promise<ProductRelations | null> {
    return this.model
      .findOne({ slug, status: 'active' }, { categoryId: 1, relatedProductIds: 1 })
      .lean<ProductRelations>()
      .exec();
  }

  /** Active product cards for these ids, in the order given (homepage picks, related products). */
  async findActiveCardsByIds(ids: readonly Types.ObjectId[]): Promise<CardSource[]> {
    if (ids.length === 0) return [];
    const found = await this.model
      .find({ _id: trusted({ $in: [...ids] }), status: 'active' }, CARD_FIELDS)
      .lean<CardSource[]>()
      .exec();
    const byId = new Map(found.map((product) => [String(product._id), product]));
    return ids.flatMap((id) => byId.get(String(id)) ?? []);
  }

  latestActiveCards(limit: number): Promise<CardSource[]> {
    return this.model
      .find({ status: 'active' }, CARD_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean<CardSource[]>()
      .exec();
  }

  /** Active cards in a category (or its sub-categories), leaving out one product. */
  activeCardsInCategory(categoryId: Types.ObjectId, excludeId: Types.ObjectId, limit: number): Promise<CardSource[]> {
    return this.model
      .find({ status: 'active', categoryPath: categoryId, _id: trusted({ $ne: excludeId }) }, CARD_FIELDS)
      .sort({ isFeatured: -1, createdAt: -1, _id: -1 })
      .limit(limit)
      .lean<CardSource[]>()
      .exec();
  }

  /** Active products per category id; a product counts for its category and its parent. */
  async activeCountsByCategory(): Promise<Map<string, number>> {
    const rows = await this.model
      .aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { status: 'active' } },
        { $unwind: '$categoryPath' },
        { $group: { _id: '$categoryPath', count: { $sum: 1 } } },
      ])
      .exec();
    return new Map(rows.map((row) => [String(row._id), row.count]));
  }

  /** Name, first image and status of these products, whatever their status (admin pickers). */
  async summaries(ids: readonly Types.ObjectId[], session?: ClientSession): Promise<ProductSummary[]> {
    if (ids.length === 0) return [];
    return this.model
      .find({ _id: trusted({ $in: [...ids] }) }, { name: 1, status: 1, images: { $slice: 1 } }, { session })
      .lean<ProductSummary[]>()
      .exec();
  }

  /** Active products per brand id (admin brand list). */
  async activeCountsByBrand(): Promise<Map<string, number>> {
    const rows = await this.model
      .aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { status: 'active' } },
        { $group: { _id: '$brandId', count: { $sum: 1 } } },
      ])
      .exec();
    return new Map(rows.map((row) => [String(row._id), row.count]));
  }

  /** Active products in a category or its sub-categories (SPEC §6.12: such a category can't be hidden). */
  countActiveInCategory(categoryId: string, session?: ClientSession): Promise<number> {
    return this.model
      .countDocuments({ status: 'active', categoryPath: new Types.ObjectId(categoryId) })
      .session(session ?? null)
      .exec();
  }

  countActiveForBrand(brandId: string, session?: ClientSession): Promise<number> {
    return this.model
      .countDocuments({ status: 'active', brandId: new Types.ObjectId(brandId) })
      .session(session ?? null)
      .exec();
  }

  /** After a category moves: its products' `categoryPath` (not a product edit, so no `updatedAt`). */
  async setCategoryPath(categoryId: Types.ObjectId, path: Types.ObjectId[], session: ClientSession): Promise<void> {
    await this.model.updateMany({ categoryId }, { $set: { categoryPath: path } }, { session, timestamps: false }).exec();
  }

  /** SPEC §5.5: renaming a brand updates the copy on its products. */
  async renameBrand(brandId: Types.ObjectId, brandName: string, session: ClientSession): Promise<void> {
    await this.model.updateMany({ brandId }, { $set: { brandName } }, { session, timestamps: false }).exec();
  }

  /** Name or brand contains the text (search-as-you-type needs partial words; `$text` can't). */
  suggest(text: string, limit: number): Promise<SuggestSource[]> {
    const pattern = contains(text);
    return this.model
      .find({ status: 'active', $or: [{ name: pattern }, { brandName: pattern }] }, SUGGEST_FIELDS)
      .sort({ isFeatured: -1, name: 1 })
      .limit(limit)
      .lean<SuggestSource[]>()
      .exec();
  }
}

@Injectable()
export class HomepageRepository {
  constructor(@InjectModel(Homepage.name) private readonly model: Model<Homepage>) {}

  /** The homepage document, or null before an admin first saves it. */
  get(session?: ClientSession): Promise<HomepageLean | null> {
    return this.model.findById(HOMEPAGE_ID, null, { session }).lean<HomepageLean>().exec();
  }

  /** Replaces it (creating it on first save) with `save()`, so the list limits are validated. */
  async replace(values: Pick<Homepage, 'banners' | 'featuredProductIds' | 'dealProductIds'>, session?: ClientSession): Promise<HomepageLean> {
    const doc = (await this.model.findById(HOMEPAGE_ID).session(session ?? null).exec()) ?? new this.model({ _id: HOMEPAGE_ID });
    doc.set(values);
    await doc.save({ session });
    return doc.toObject<HomepageLean>();
  }
}
