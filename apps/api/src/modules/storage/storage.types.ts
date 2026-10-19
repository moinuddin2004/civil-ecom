/**
 * File storage (SPEC §12.1). Two buckets: **public** (images served to everyone through
 * `PUBLIC_IMAGE_BASE_URL`) and **private** (receipts, import files), which are only ever handed
 * out as short-lived signed links after a permission check.
 */
export type Bucket = 'public' | 'private';

export interface StoredObject {
  body: Buffer;
  contentType: string;
}

export interface PutOptions {
  contentType: string;
  /** `Cache-Control` for public files (the CDN and browsers keep them). */
  cacheControl?: string;
}

export interface SignedUrlOptions {
  expiresInSeconds: number;
  /** Suggested file name when the browser saves it (`Content-Disposition`). */
  downloadName?: string;
}

/** One storage backend: local disk in development, Cloudflare R2 in production. */
export interface StorageDriver {
  put(bucket: Bucket, key: string, body: Buffer, options: PutOptions): Promise<void>;
  /** null when there is no such file. */
  get(bucket: Bucket, key: string): Promise<StoredObject | null>;
  delete(bucket: Bucket, keys: readonly string[]): Promise<void>;
  /** A link to a private file that stops working after `expiresInSeconds`. */
  signedUrl(key: string, options: SignedUrlOptions): Promise<string>;
}

/** Keys are made by our own code (`@aricon/shared` images.ts); anything else is refused. */
const SAFE_KEY = /^[a-z]+(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)+$/;

export function isSafeKey(key: string): boolean {
  return SAFE_KEY.test(key) && !key.split('/').includes('..') && key.length <= 300;
}

export function assertSafeKey(key: string): void {
  if (!isSafeKey(key)) throw new Error(`Refusing unsafe storage key "${key}"`);
}

const CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Content type from a key's extension (keys always carry the real one, see SPEC §12.1). */
export function contentTypeOf(key: string): string {
  const extension = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}
