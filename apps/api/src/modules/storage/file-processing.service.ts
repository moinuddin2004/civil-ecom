import { IMAGE_UPLOAD_MAX_BYTES, IMPORT_UPLOAD_MAX_BYTES, PRODUCT_IMAGE_WIDTHS, RECEIPT_UPLOAD_MAX_BYTES, formatFileSize, type ProductImageWidth } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import sharp, { type Sharp } from 'sharp';
import { AppError } from '../../common/errors/app-error.js';
import { AppConfig } from '../../config/app-config.service.js';
import { sniffFileType, type SniffedType } from './file-sniff.js';

/** What the upload endpoints receive from Multer (memory storage). */
export interface UploadedFileInput {
  buffer: Buffer;
  size: number;
}

export interface ProcessedReceipt {
  body: Buffer;
  extension: 'jpg' | 'png' | 'webp' | 'pdf';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
}

const WEBP_QUALITY = 80;
const IMAGE_TYPES: readonly SniffedType[] = ['jpg', 'png', 'webp'];

/** Banner widths (SPEC §12.2); category images and brand logos get one modest size. */
const BANNER_WIDTH = { desktop: 1600, mobile: 800 } as const;
const CATEGORY_IMAGE_WIDTH = 800;
const BRAND_LOGO_WIDTH = 400;

function unsupported(message: string): AppError {
  return new AppError('UNSUPPORTED_FILE', message);
}

function tooLarge(maxBytes: number): AppError {
  return new AppError('PAYLOAD_TOO_LARGE', `The file is too large. Choose one under ${formatFileSize(maxBytes)}.`);
}

/**
 * Checks and processes uploads (SPEC §12.2, CLAUDE.md §30): real type from the file's bytes, size
 * limits, and images re-encoded with sharp — auto-rotated, metadata stripped, resized without
 * upscaling, WebP. Nothing an uploader sent is stored as it came, except PDF receipts and xlsx
 * imports (kept byte for byte, but only after their signature checks out).
 */
@Injectable()
export class FileProcessingService {
  constructor(config: AppConfig) {
    // One vCPU in production (CLAUDE.md §32): one sharp thread, no in-memory cache.
    if (config.isProduction) sharp.concurrency(1);
    sharp.cache(false);
  }

  /** Product photo → the three widths stored under its prefix (SPEC §12.1). */
  async productImage(file: UploadedFileInput | undefined): Promise<Map<ProductImageWidth, Buffer>> {
    const input = this.image(file);
    const sizes = new Map<ProductImageWidth, Buffer>();
    for (const width of PRODUCT_IMAGE_WIDTHS) sizes.set(width, await this.toWebp(input, width));
    return sizes;
  }

  bannerImage(file: UploadedFileInput | undefined, variant: 'desktop' | 'mobile'): Promise<Buffer> {
    return this.toWebp(this.image(file), BANNER_WIDTH[variant]);
  }

  categoryImage(file: UploadedFileInput | undefined): Promise<Buffer> {
    return this.toWebp(this.image(file), CATEGORY_IMAGE_WIDTH);
  }

  brandLogo(file: UploadedFileInput | undefined): Promise<Buffer> {
    return this.toWebp(this.image(file), BRAND_LOGO_WIDTH);
  }

  /** Bank receipt (SPEC §6.8): a photo is re-encoded in its own format to drop metadata; a PDF is kept. */
  async receipt(file: UploadedFileInput | undefined): Promise<ProcessedReceipt> {
    const input = this.checked(file, RECEIPT_UPLOAD_MAX_BYTES);
    const type = sniffFileType(input);
    if (type === 'pdf') return { body: input, extension: 'pdf', mimeType: 'application/pdf' };
    if (type !== 'jpg' && type !== 'png' && type !== 'webp') {
      throw unsupported('Upload a photo (JPG, PNG or WebP) or a PDF of the receipt.');
    }
    const image = this.pipeline(input);
    const body = await this.decode(() =>
      type === 'jpg' ? image.jpeg({ quality: 85 }).toBuffer() : type === 'png' ? image.png().toBuffer() : image.webp({ quality: 85 }).toBuffer(),
    );
    return { body, extension: type, mimeType: type === 'jpg' ? 'image/jpeg' : type === 'png' ? 'image/png' : 'image/webp' };
  }

  /** Excel import file (SPEC §12.3): an xlsx up to 5 MB, stored as it is. */
  spreadsheet(file: UploadedFileInput | undefined): Buffer {
    const input = this.checked(file, IMPORT_UPLOAD_MAX_BYTES);
    if (sniffFileType(input) !== 'xlsx') throw unsupported('Upload the filled-in template as an .xlsx file.');
    return input;
  }

  /** Downloaded image for an import row (`image_urls`): same rules as an upload. */
  async productImageFromBytes(bytes: Buffer): Promise<Map<ProductImageWidth, Buffer>> {
    return this.productImage({ buffer: bytes, size: bytes.length });
  }

  private image(file: UploadedFileInput | undefined): Buffer {
    const input = this.checked(file, IMAGE_UPLOAD_MAX_BYTES);
    const type = sniffFileType(input);
    if (!type || !IMAGE_TYPES.includes(type)) throw unsupported('Upload a JPG, PNG or WebP image.');
    return input;
  }

  private checked(file: UploadedFileInput | undefined, maxBytes: number): Buffer {
    if (!file || file.size === 0) throw AppError.validation('Choose a file to upload.', [{ path: 'file', message: 'Choose a file to upload.' }]);
    if (file.size > maxBytes) throw tooLarge(maxBytes);
    return file.buffer;
  }

  /** Auto-rotate from EXIF, then (implicitly) drop every bit of metadata on output. */
  private pipeline(input: Buffer): Sharp {
    return sharp(input, { failOn: 'error', limitInputPixels: 50_000_000 }).rotate();
  }

  private toWebp(input: Buffer, width: number): Promise<Buffer> {
    return this.decode(() =>
      this.pipeline(input).resize({ width, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer(),
    );
  }

  /** A file that passes the signature check but isn't a readable image is still refused. */
  private async decode(render: () => Promise<Buffer>): Promise<Buffer> {
    try {
      return await render();
    } catch {
      throw unsupported("We couldn't read this image. Try saving it again as JPG or PNG.");
    }
  }
}
