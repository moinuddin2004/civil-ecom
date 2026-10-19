import { bannerImageKey, brandLogoKey, categoryImageKey, productImageFileKey, productImagePrefix } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { FileProcessingService, type UploadedFileInput } from '../storage/file-processing.service.js';
import { SHORT_CACHE, StorageService } from '../storage/storage.service.js';

const WEBP = 'image/webp';

/** The id an upload belongs to: the one given (lower-cased like stored ids) or a new one. */
function ownerId(given: string | undefined): string {
  return given ? given.toLowerCase() : new Types.ObjectId().toHexString();
}

/**
 * Admin image uploads (SPEC §7.3, §12): process, store in the public bucket, return the key. The
 * key is only *used* when the product/category/brand/homepage is saved with it — those endpoints
 * check the key belongs to that record.
 */
@Injectable()
export class UploadsService {
  constructor(
    private readonly files: FileProcessingService,
    private readonly storage: StorageService,
  ) {}

  /** Three widths under a new image id; product image keys are never rewritten, so cached for good. */
  async productImage(file: UploadedFileInput | undefined, productId?: string): Promise<{ key: string; productId: string }> {
    const sizes = await this.files.productImage(file);
    const owner = ownerId(productId);
    const prefix = productImagePrefix(owner, new Types.ObjectId().toHexString());
    await Promise.all([...sizes].map(([width, body]) => this.storage.putPublic(productImageFileKey(prefix, width), body, WEBP)));
    return { key: prefix, productId: owner };
  }

  async categoryImage(file: UploadedFileInput | undefined, categoryId?: string): Promise<{ key: string; categoryId: string }> {
    const body = await this.files.categoryImage(file);
    const owner = ownerId(categoryId);
    const key = categoryImageKey(owner);
    await this.storage.putPublic(key, body, WEBP, SHORT_CACHE);
    return { key, categoryId: owner };
  }

  async brandLogo(file: UploadedFileInput | undefined, brandId?: string): Promise<{ key: string; brandId: string }> {
    const body = await this.files.brandLogo(file);
    const owner = ownerId(brandId);
    const key = brandLogoKey(owner);
    await this.storage.putPublic(key, body, WEBP, SHORT_CACHE);
    return { key, brandId: owner };
  }

  async banner(file: UploadedFileInput | undefined, variant: 'desktop' | 'mobile', bannerId?: string): Promise<{ key: string; bannerId: string }> {
    const body = await this.files.bannerImage(file, variant);
    const owner = ownerId(bannerId);
    const key = bannerImageKey(owner, variant);
    await this.storage.putPublic(key, body, WEBP, SHORT_CACHE);
    return { key, bannerId: owner };
  }
}
