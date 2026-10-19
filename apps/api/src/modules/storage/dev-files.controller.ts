import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { RawResponse } from '../../common/http/envelope.js';
import { Public } from '../auth/auth.decorators.js';
import { LocalStorageDriver } from './local-storage.driver.js';
import { StorageService } from './storage.service.js';
import { isSafeKey, type Bucket } from './storage.types.js';

/** Express 5 hands a `*key` wildcard over as its path segments. */
function joinKey(value: string | string[]): string {
  return Array.isArray(value) ? value.join('/') : value;
}

/**
 * Serves locally stored files in development (`PUBLIC_IMAGE_BASE_URL=…/api/dev-files`), standing
 * in for the R2 public bucket and its presigned links. With the R2 driver every path is a 404.
 */
@ApiExcludeController()
@Controller('dev-files')
@Public()
@RawResponse()
@SkipThrottle()
export class DevFilesController {
  constructor(private readonly storage: StorageService) {}

  /** A private file through a link made by `privateUrl()`: genuine and not expired. */
  @Get('private/*key')
  async privateFile(
    @Param('key') key: string | string[],
    @Query('expires') expires: string | undefined,
    @Query('signature') signature: string | undefined,
    @Query('name') name: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const driver = this.localDriver();
    const path = joinKey(key);
    if (!isSafeKey(path) || !signature || !driver.verify(path, Number(expires), name ?? '', signature)) {
      throw AppError.forbidden('This link has expired. Open the file again from the admin panel.');
    }
    await this.send(driver, 'private', path, res, name);
  }

  @Get('*key')
  async publicFile(@Param('key') key: string | string[], @Res() res: Response): Promise<void> {
    const driver = this.localDriver();
    const path = joinKey(key);
    if (!isSafeKey(path)) throw AppError.notFound();
    await this.send(driver, 'public', path, res);
  }

  private localDriver(): LocalStorageDriver {
    if (!(this.storage.driver instanceof LocalStorageDriver)) throw AppError.notFound();
    return this.storage.driver;
  }

  private async send(driver: LocalStorageDriver, bucket: Bucket, key: string, res: Response, name?: string): Promise<void> {
    const file = await driver.get(bucket, key);
    if (!file) throw AppError.notFound("We couldn't find that file.");
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', bucket === 'public' ? 'public, max-age=300' : 'private, no-store');
    if (name) res.setHeader('Content-Disposition', `inline; filename="${name.replace(/["\\\r\n]/g, '')}"`);
    res.send(file.body);
  }
}
