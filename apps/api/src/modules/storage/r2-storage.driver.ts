import { DeleteObjectsCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { assertSafeKey, contentTypeOf, type Bucket, type PutOptions, type SignedUrlOptions, type StorageDriver, type StoredObject } from './storage.types.js';

export interface R2Settings {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBucket: string;
  privateBucket: string;
}

/** Production storage: Cloudflare R2 through its S3-compatible API (CLAUDE.md §30, SPEC §12). */
export class R2StorageDriver implements StorageDriver {
  private readonly client: S3Client;

  constructor(private readonly settings: R2Settings) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
    });
  }

  private bucketName(bucket: Bucket): string {
    return bucket === 'public' ? this.settings.publicBucket : this.settings.privateBucket;
  }

  async put(bucket: Bucket, key: string, body: Buffer, options: PutOptions): Promise<void> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName(bucket),
        Key: key,
        Body: body,
        ContentType: options.contentType,
        ...(options.cacheControl && { CacheControl: options.cacheControl }),
      }),
    );
  }

  async get(bucket: Bucket, key: string): Promise<StoredObject | null> {
    assertSafeKey(key);
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucketName(bucket), Key: key }));
      if (!result.Body) return null;
      return { body: Buffer.from(await result.Body.transformToByteArray()), contentType: result.ContentType ?? contentTypeOf(key) };
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  }

  async delete(bucket: Bucket, keys: readonly string[]): Promise<void> {
    if (keys.length === 0) return;
    keys.forEach(assertSafeKey);
    await this.client.send(
      new DeleteObjectsCommand({ Bucket: this.bucketName(bucket), Delete: { Objects: keys.map((key) => ({ Key: key })), Quiet: true } }),
    );
  }

  async signedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    assertSafeKey(key);
    const command = new GetObjectCommand({
      Bucket: this.settings.privateBucket,
      Key: key,
      ...(options.downloadName && { ResponseContentDisposition: `inline; filename="${options.downloadName.replace(/["\\\r\n]/g, '')}"` }),
    });
    return getSignedUrl(this.client, command, { expiresIn: options.expiresInSeconds });
  }
}
