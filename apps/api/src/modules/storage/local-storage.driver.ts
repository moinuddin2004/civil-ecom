import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertSafeKey, contentTypeOf, type Bucket, type PutOptions, type SignedUrlOptions, type StorageDriver, type StoredObject } from './storage.types.js';

/** Where the development API serves stored files (the web app proxies `/api` to it). */
export const DEV_FILES_PATH = '/api/dev-files';

/**
 * Development storage (SPEC §3.3): files on local disk under `{root}/public` and `{root}/private`.
 * Public files are served at `/api/dev-files/{key}`; a private file only through a signed link
 * `/api/dev-files/private/{key}?expires=…&signature=…` that works like an R2 presigned URL.
 */
export class LocalStorageDriver implements StorageDriver {
  private readonly root: string;

  constructor(
    root: string,
    private readonly appUrl: string,
    private readonly signingKey: string,
  ) {
    this.root = path.resolve(root);
  }

  private pathOf(bucket: Bucket, key: string): string {
    assertSafeKey(key);
    const full = path.resolve(this.root, bucket, key);
    // Belt and braces: a safe key can't climb out of the bucket folder.
    if (!full.startsWith(path.resolve(this.root, bucket) + path.sep)) throw new Error(`Key "${key}" escapes the storage folder`);
    return full;
  }

  async put(bucket: Bucket, key: string, body: Buffer, _options: PutOptions): Promise<void> {
    const file = this.pathOf(bucket, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  async get(bucket: Bucket, key: string): Promise<StoredObject | null> {
    try {
      return { body: await readFile(this.pathOf(bucket, key)), contentType: contentTypeOf(key) };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(bucket: Bucket, keys: readonly string[]): Promise<void> {
    await Promise.all(keys.map((key) => rm(this.pathOf(bucket, key), { force: true })));
  }

  async signedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    assertSafeKey(key);
    const expires = Math.floor(Date.now() / 1000) + options.expiresInSeconds;
    const name = options.downloadName ?? '';
    const params = new URLSearchParams({ expires: String(expires), signature: this.sign(key, expires, name) });
    if (name) params.set('name', name);
    return Promise.resolve(`${this.appUrl}${DEV_FILES_PATH}/private/${key}?${params.toString()}`);
  }

  /** True when a signed link is genuine and hasn't expired. */
  verify(key: string, expires: number, name: string, signature: string): boolean {
    if (!Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000)) return false;
    const expected = Buffer.from(this.sign(key, expires, name));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  private sign(key: string, expires: number, name: string): string {
    return createHmac('sha256', this.signingKey).update(`dev-file\n${key}\n${expires}\n${name}`).digest('base64url');
  }
}
