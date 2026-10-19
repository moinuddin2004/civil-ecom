import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service.js';
import { LocalStorageDriver } from './local-storage.driver.js';
import { R2StorageDriver } from './r2-storage.driver.js';
import type { StorageDriver, StoredObject } from './storage.types.js';

/** Private links last 10 minutes (CLAUDE.md §30, SPEC §6.8). */
export const PRIVATE_URL_TTL_SECONDS = 10 * 60;

/** Keys that are never rewritten (product images get a new id per upload): cache for a year. */
export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
/** Keys reused on re-upload (category image, brand logo, banners): short browser cache. */
export const SHORT_CACHE = 'public, max-age=300, stale-while-revalidate=86400';

/**
 * The app's file store (SPEC §12): picks the driver from `STORAGE_DRIVER` once and hides which one
 * it is. Public files go to the public bucket, everything else (receipts, imports) to the private
 * one, reachable only through `privateUrl()`.
 */
@Injectable()
export class StorageService {
  readonly driver: StorageDriver;

  constructor(config: AppConfig) {
    if (config.get('STORAGE_DRIVER') === 'r2') {
      this.driver = new R2StorageDriver({
        accountId: required(config.get('R2_ACCOUNT_ID')),
        accessKeyId: required(config.get('R2_ACCESS_KEY_ID')),
        secretAccessKey: required(config.get('R2_SECRET_ACCESS_KEY')),
        publicBucket: required(config.get('R2_PUBLIC_BUCKET')),
        privateBucket: required(config.get('R2_PRIVATE_BUCKET')),
      });
    } else {
      // Signed dev links reuse a server secret; the local driver never runs in production.
      this.driver = new LocalStorageDriver(config.get('STORAGE_LOCAL_DIR'), config.get('APP_URL'), config.get('JWT_ADMIN_SECRET'));
    }
  }

  putPublic(key: string, body: Buffer, contentType: string, cacheControl = IMMUTABLE_CACHE): Promise<void> {
    return this.driver.put('public', key, body, { contentType, cacheControl });
  }

  putPrivate(key: string, body: Buffer, contentType: string): Promise<void> {
    return this.driver.put('private', key, body, { contentType });
  }

  getPrivate(key: string): Promise<StoredObject | null> {
    return this.driver.get('private', key);
  }

  deletePublic(keys: readonly string[]): Promise<void> {
    return this.driver.delete('public', keys);
  }

  deletePrivate(keys: readonly string[]): Promise<void> {
    return this.driver.delete('private', keys);
  }

  /** A 10-minute link to a private file. Callers check permission first. */
  privateUrl(key: string, downloadName?: string): Promise<string> {
    return this.driver.signedUrl(key, { expiresInSeconds: PRIVATE_URL_TTL_SECONDS, downloadName });
  }
}

/** The env schema already requires these with `STORAGE_DRIVER=r2`; this narrows the type. */
function required(value: string | undefined): string {
  if (!value) throw new Error('R2 storage is selected but its settings are incomplete');
  return value;
}
