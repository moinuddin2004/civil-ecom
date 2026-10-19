import { CACHE_TAGS, slugify, type AdminBrandDTO, type AdminCategoryDTO } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../../common/errors/app-error.js';
import { isDuplicateKey } from '../../../common/errors/mongo-errors.js';
import { definedOnly } from '../../../common/utils/objects.js';
import { TransactionService } from '../../../database/transaction.service.js';
import type { Brand, BrandLean } from '../../../models/brand.model.js';
import type { Category, CategoryLean } from '../../../models/category.model.js';
import { AuditService, changedFields, snapshot, type AuditActor } from '../../audit/audit.service.js';
import { RevalidationService } from '../../revalidation/revalidation.service.js';
import { BrandsRepository, CatalogProductsRepository, CategoriesRepository } from '../catalog.repositories.js';
import type { CreateBrandDto, CreateCategoryDto, UpdateBrandDto, UpdateCategoryDto } from './dto/admin-catalog.dto.js';

const CATEGORY_FIELDS = ['name', 'slug', 'parentId', 'description', 'imageKey', 'sortOrder', 'showOnHome', 'status'] as const;
const BRAND_FIELDS = ['name', 'slug', 'logoKey', 'sortOrder', 'status'] as const;

const CATEGORY_NOT_FOUND = "We couldn't find that category.";
const BRAND_NOT_FOUND = "We couldn't find that brand.";

const fieldError = (path: string, message: string) => AppError.validation(message, [{ path, message }]);
const slugTaken = (what: string) =>
  AppError.conflict(`Another ${what} already uses this URL name. Choose a different one.`, [
    { path: 'slug', message: `Another ${what} already uses this URL name.` },
  ]);

function toCategoryDto(category: CategoryLean, counts: ReadonlyMap<string, number>): AdminCategoryDTO {
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    parentId: category.parentId ? String(category.parentId) : null,
    description: category.description ?? null,
    imageKey: category.imageKey ?? null,
    sortOrder: category.sortOrder,
    showOnHome: category.showOnHome,
    status: category.status,
    productCount: counts.get(String(category._id)) ?? 0,
  };
}

function toBrandDto(brand: BrandLean, counts: ReadonlyMap<string, number>): AdminBrandDTO {
  return {
    id: String(brand._id),
    name: brand.name,
    slug: brand.slug,
    logoKey: brand.logoKey ?? null,
    sortOrder: brand.sortOrder,
    status: brand.status,
    productCount: counts.get(String(brand._id)) ?? 0,
  };
}

/** A slug sent by the admin, or one made from the name. */
function slugFor(name: string, slug?: string): string {
  const value = slug ?? slugify(name);
  if (!value) throw fieldError('slug', 'Enter a URL name using letters or numbers.');
  return value;
}

/** An uploaded key carries the id it was uploaded for; it must be this record's. */
function assertKeyOwner(key: string | null | undefined, id: string, path: string): void {
  if (key && !key.includes(`/${id}/`)) throw fieldError(path, 'This file was uploaded for something else. Upload it again.');
}

/**
 * Categories and brands for the admin panel (SPEC §7.3 "Catalog", §5.4–5.5, §6.12). Writes are
 * audited in the same transaction and refresh the storefront pages that show them.
 */
@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly categories: CategoriesRepository,
    private readonly brands: BrandsRepository,
    private readonly products: CatalogProductsRepository,
    private readonly audit: AuditService,
    private readonly revalidation: RevalidationService,
  ) {}

  /* Categories */

  async listCategories(): Promise<AdminCategoryDTO[]> {
    const [categories, counts] = await Promise.all([this.categories.findAll(), this.products.activeCountsByCategory()]);
    return categories.map((category) => toCategoryDto(category, counts));
  }

  async createCategory(actor: AuditActor, input: CreateCategoryDto): Promise<AdminCategoryDTO> {
    const id = new Types.ObjectId(input.id);
    const slug = slugFor(input.name, input.slug);
    assertKeyOwner(input.imageKey, String(id), 'imageKey');
    if (await this.categories.slugTaken(slug)) throw slugTaken('category');

    const fields: Partial<Category> = {
      name: input.name,
      slug,
      parentId: input.parentId ? new Types.ObjectId(input.parentId) : null,
      description: input.description,
      imageKey: input.imageKey ?? undefined,
      sortOrder: input.sortOrder ?? 0,
      showOnHome: input.showOnHome ?? false,
      status: input.status ?? 'active',
    };
    const category = await this.write(() =>
      this.transactions.run(async (session) => {
        if (fields.parentId) await this.assertValidParent(String(fields.parentId), String(id), session);
        const created = await this.categories.create({ _id: id, ...fields }, session);
        await this.audit.record(
          actor,
          { action: 'category.created', entity: 'category', entityId: String(id), after: snapshot(created, CATEGORY_FIELDS) },
          session,
        );
        return created;
      }),
    'category');

    this.revalidation.revalidate([CACHE_TAGS.category(slug), CACHE_TAGS.catalog, CACHE_TAGS.home]);
    return toCategoryDto(category, new Map());
  }

  async updateCategory(actor: AuditActor, id: string, input: UpdateCategoryDto): Promise<AdminCategoryDTO> {
    assertKeyOwner(input.imageKey, id, 'imageKey');
    if (input.slug && (await this.categories.slugTaken(input.slug, id))) throw slugTaken('category');

    const changes: Partial<Category> = {
      ...definedOnly(input, ['name', 'slug', 'sortOrder', 'showOnHome', 'status'] as const),
      ...(input.parentId !== undefined && { parentId: input.parentId ? new Types.ObjectId(input.parentId) : null }),
      ...(input.description !== undefined && { description: input.description ?? undefined }),
      ...(input.imageKey !== undefined && { imageKey: input.imageKey ?? undefined }),
    };

    const { before, after } = await this.write(() =>
      this.transactions.run(async (session) => {
        const current = await this.categories.findById(id, session);
        if (!current) throw AppError.notFound(CATEGORY_NOT_FOUND);

        const moving = changes.parentId !== undefined && String(changes.parentId) !== String(current.parentId);
        if (moving && changes.parentId) {
          await this.assertValidParent(String(changes.parentId), id, session);
          if (await this.categories.hasChildren(id, session)) {
            throw fieldError('parentId', 'This category has sub-categories, so it must stay at the top level.');
          }
        }
        if (changes.status === 'hidden' && current.status !== 'hidden') {
          const active = await this.products.countActiveInCategory(id, session);
          if (active > 0) {
            throw AppError.conflict(
              `This category still has ${active} active product${active === 1 ? '' : 's'}. Hide or move them first.`,
              { activeProducts: active },
            );
          }
        }

        const updated = await this.categories.updateById(id, changes, session);
        if (!updated) throw AppError.notFound(CATEGORY_NOT_FOUND);
        // Products keep `[parent, category]` for listing filters; a move changes that path.
        if (moving) {
          await this.products.setCategoryPath(updated._id, updated.parentId ? [updated.parentId, updated._id] : [updated._id], session);
        }
        const diff = changedFields(current, updated, CATEGORY_FIELDS);
        if (Object.keys(diff.after).length > 0) {
          await this.audit.record(actor, { action: 'category.updated', entity: 'category', entityId: id, ...diff }, session);
        }
        return { before: current, after: updated };
      }),
    'category');

    this.revalidation.revalidate([
      CACHE_TAGS.category(before.slug),
      CACHE_TAGS.category(after.slug),
      CACHE_TAGS.catalog,
      CACHE_TAGS.home,
    ]);
    const counts = await this.products.activeCountsByCategory();
    return toCategoryDto(after, counts);
  }

  /** Two levels at most: the parent must exist, be top level and not be the category itself. */
  private async assertValidParent(parentId: string, id: string, session: ClientSession): Promise<void> {
    const parent = parentId === id ? null : await this.categories.findById(parentId, session);
    if (!parent || parent.parentId) throw fieldError('parentId', 'Choose a top-level category as the parent.');
  }

  /* Brands */

  async listBrands(): Promise<AdminBrandDTO[]> {
    const [brands, counts] = await Promise.all([this.brands.findAll(), this.products.activeCountsByBrand()]);
    return brands.map((brand) => toBrandDto(brand, counts));
  }

  async createBrand(actor: AuditActor, input: CreateBrandDto): Promise<AdminBrandDTO> {
    const id = new Types.ObjectId(input.id);
    const slug = slugFor(input.name, input.slug);
    assertKeyOwner(input.logoKey, String(id), 'logoKey');
    if (await this.brands.slugTaken(slug)) throw slugTaken('brand');

    const fields: Partial<Brand> = {
      name: input.name,
      slug,
      logoKey: input.logoKey ?? undefined,
      sortOrder: input.sortOrder ?? 0,
      status: input.status ?? 'active',
    };
    const brand = await this.write(() =>
      this.transactions.run(async (session) => {
        const created = await this.brands.create({ _id: id, ...fields }, session);
        await this.audit.record(
          actor,
          { action: 'brand.created', entity: 'brand', entityId: String(id), after: snapshot(created, BRAND_FIELDS) },
          session,
        );
        return created;
      }),
    'brand');

    this.revalidation.revalidate([CACHE_TAGS.brand(slug), CACHE_TAGS.catalog, CACHE_TAGS.home]);
    return toBrandDto(brand, new Map());
  }

  async updateBrand(actor: AuditActor, id: string, input: UpdateBrandDto): Promise<AdminBrandDTO> {
    assertKeyOwner(input.logoKey, id, 'logoKey');
    if (input.slug && (await this.brands.slugTaken(input.slug, id))) throw slugTaken('brand');

    const changes: Partial<Brand> = {
      ...definedOnly(input, ['name', 'slug', 'sortOrder', 'status'] as const),
      ...(input.logoKey !== undefined && { logoKey: input.logoKey ?? undefined }),
    };

    const { before, after } = await this.write(() =>
      this.transactions.run(async (session) => {
        const current = await this.brands.findById(id, session);
        if (!current) throw AppError.notFound(BRAND_NOT_FOUND);
        if (changes.status === 'hidden' && current.status !== 'hidden') {
          const active = await this.products.countActiveForBrand(id, session);
          if (active > 0) {
            throw AppError.conflict(
              `This brand still has ${active} active product${active === 1 ? '' : 's'}. Hide them first.`,
              { activeProducts: active },
            );
          }
        }

        const updated = await this.brands.updateById(id, changes, session);
        if (!updated) throw AppError.notFound(BRAND_NOT_FOUND);
        if (updated.name !== current.name) await this.products.renameBrand(updated._id, updated.name, session);
        const diff = changedFields(current, updated, BRAND_FIELDS);
        if (Object.keys(diff.after).length > 0) {
          await this.audit.record(actor, { action: 'brand.updated', entity: 'brand', entityId: id, ...diff }, session);
        }
        return { before: current, after: updated };
      }),
    'brand');

    this.revalidation.revalidate([CACHE_TAGS.brand(before.slug), CACHE_TAGS.brand(after.slug), CACHE_TAGS.catalog, CACHE_TAGS.home]);
    const counts = await this.products.activeCountsByBrand();
    return toBrandDto(after, counts);
  }

  /** A slug taken by a concurrent write (between our check and the insert) is still a 409. */
  private async write<T>(run: () => Promise<T>, what: 'category' | 'brand'): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isDuplicateKey(error, 'slug')) throw slugTaken(what);
      throw error;
    }
  }
}
