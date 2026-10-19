import { CACHE_TAGS, type AdminHomepageDTO } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../../common/errors/app-error.js';
import { TransactionService } from '../../../database/transaction.service.js';
import { HOMEPAGE_ID, type Banner, type HomepageLean } from '../../../models/homepage.model.js';
import { AuditService, changedFields, type AuditActor } from '../../audit/audit.service.js';
import { RevalidationService } from '../../revalidation/revalidation.service.js';
import { CatalogProductsRepository, HomepageRepository, type ProductSummary } from '../catalog.repositories.js';
import type { UpdateHomepageDto } from './dto/admin-homepage.dto.js';

const AUDITED_FIELDS = ['banners', 'featuredProductIds', 'dealProductIds'] as const;

type Picked = AdminHomepageDTO['featuredProducts'][number];
type HomepageContent = Pick<HomepageLean, (typeof AUDITED_FIELDS)[number]>;

function picked(ids: readonly Types.ObjectId[], products: ReadonlyMap<string, ProductSummary>): Picked[] {
  return ids.flatMap((id) => {
    const product = products.get(String(id));
    return product
      ? [{ id: String(product._id), name: product.name, imageKey: product.images[0]?.key ?? null, status: product.status }]
      : [];
  });
}

/** Homepage banners and product picks (SPEC §5.13, §10.10), `homepage.manage`. */
@Injectable()
export class AdminHomepageService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly homepage: HomepageRepository,
    private readonly products: CatalogProductsRepository,
    private readonly audit: AuditService,
    private readonly revalidation: RevalidationService,
  ) {}

  async get(): Promise<AdminHomepageDTO> {
    return this.toDto(await this.homepage.get());
  }

  async update(actor: AuditActor, input: UpdateHomepageDto): Promise<AdminHomepageDTO> {
    const banners: Banner[] = input.banners.map((banner, index) => {
      // Upload keys carry the banner id they were uploaded for.
      for (const [field, key] of [['desktopKey', banner.desktopKey], ['mobileKey', banner.mobileKey]] as const) {
        if (key && !key.includes(`/${banner.id}/`)) {
          const message = 'This image was uploaded for another banner. Upload it again.';
          throw AppError.validation(message, [{ path: `banners.${index}.${field}`, message }]);
        }
      }
      return {
        _id: new Types.ObjectId(banner.id),
        desktopKey: banner.desktopKey,
        mobileKey: banner.mobileKey ?? null,
        alt: banner.alt,
        link: banner.link ?? null,
        isActive: banner.isActive ?? true,
        sortOrder: banner.sortOrder ?? index,
      };
    });
    const featuredProductIds = input.featuredProductIds.map((id) => new Types.ObjectId(id));
    const dealProductIds = input.dealProductIds.map((id) => new Types.ObjectId(id));

    const saved = await this.transactions.run(async (session) => {
      await this.assertProductsExist('featuredProductIds', featuredProductIds, session);
      await this.assertProductsExist('dealProductIds', dealProductIds, session);
      const before = await this.homepage.get(session);
      const after = await this.homepage.replace({ banners, featuredProductIds, dealProductIds }, session);
      const empty: HomepageContent = { banners: [], featuredProductIds: [], dealProductIds: [] };
      const diff = changedFields<HomepageContent>(before ?? empty, after, AUDITED_FIELDS);
      if (Object.keys(diff.after).length > 0) {
        await this.audit.record(actor, { action: 'homepage.updated', entity: 'homepage', entityId: HOMEPAGE_ID, ...diff }, session);
      }
      return after;
    });

    this.revalidation.revalidate([CACHE_TAGS.home]);
    return this.toDto(saved);
  }

  /** Every pick must be a real product (any status: hidden ones are kept but not shown). */
  private async assertProductsExist(path: string, ids: readonly Types.ObjectId[], session: ClientSession): Promise<void> {
    const found = new Set((await this.products.summaries(ids, session)).map((product) => String(product._id)));
    const index = ids.findIndex((id) => !found.has(String(id)));
    if (index >= 0) {
      const message = "One of the picked products doesn't exist any more. Remove it and save again.";
      throw AppError.validation(message, [{ path: `${path}.${index}`, message }]);
    }
  }

  private async toDto(home: HomepageLean | null): Promise<AdminHomepageDTO> {
    const featured = home?.featuredProductIds ?? [];
    const deals = home?.dealProductIds ?? [];
    const summaries = await this.products.summaries([...featured, ...deals]);
    const byId = new Map(summaries.map((product) => [String(product._id), product]));
    return {
      banners: [...(home?.banners ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((banner) => ({
          id: String(banner._id),
          desktopKey: banner.desktopKey,
          mobileKey: banner.mobileKey ?? null,
          alt: banner.alt,
          link: banner.link ?? null,
          isActive: banner.isActive,
          sortOrder: banner.sortOrder,
        })),
      featuredProducts: picked(featured, byId),
      dealProducts: picked(deals, byId),
    };
  }
}
