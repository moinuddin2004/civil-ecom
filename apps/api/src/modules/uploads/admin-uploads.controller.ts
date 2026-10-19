import { IMAGE_UPLOAD_MAX_BYTES } from '@aricon/shared';
import { Body, Controller, HttpCode, Post, UploadedFile } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import { FileUpload } from '../../common/http/file-upload.decorator.js';
import { RequireAnyPermission, RequirePermission } from '../auth/auth.decorators.js';
import type { UploadedFileInput } from '../storage/file-processing.service.js';
import {
  BannerUploadDto,
  BannerUploadResponseDto,
  BrandLogoUploadDto,
  BrandLogoUploadResponseDto,
  CategoryImageUploadDto,
  CategoryImageUploadResponseDto,
  ProductImageUploadDto,
  ProductImageUploadResponseDto,
} from './dto/uploads.dto.js';
import { UploadsService } from './uploads.service.js';

const OWNER_FIELD = (name: string) => ({ [name]: { type: 'string' as const, description: 'Owner id; left out for a new record.' } });

/** SPEC §7.3 uploads: multipart `file` (JPG/PNG/WebP up to 8 MB) → a public storage key. */
@ApiTags('Admin uploads')
@Controller('admin/uploads')
export class AdminUploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('product-image')
  @HttpCode(201)
  @RequireAnyPermission('products.create', 'products.edit')
  @FileUpload(IMAGE_UPLOAD_MAX_BYTES, OWNER_FIELD('productId'))
  @ApiOperation({ summary: 'Upload a product photo (stored in 300/800/1600 px WebP)' })
  @ApiDataResponse(ProductImageUploadResponseDto, { status: 201 })
  @ApiErrorResponses(400, 401, 403, 413, 415)
  productImage(@UploadedFile() file: UploadedFileInput | undefined, @Body() body: ProductImageUploadDto) {
    return this.uploads.productImage(file, body.productId);
  }

  @Post('category-image')
  @HttpCode(201)
  @RequirePermission('categories.manage')
  @FileUpload(IMAGE_UPLOAD_MAX_BYTES, OWNER_FIELD('categoryId'))
  @ApiOperation({ summary: 'Upload a category image' })
  @ApiDataResponse(CategoryImageUploadResponseDto, { status: 201 })
  @ApiErrorResponses(400, 401, 403, 413, 415)
  categoryImage(@UploadedFile() file: UploadedFileInput | undefined, @Body() body: CategoryImageUploadDto) {
    return this.uploads.categoryImage(file, body.categoryId);
  }

  @Post('brand-logo')
  @HttpCode(201)
  @RequirePermission('brands.manage')
  @FileUpload(IMAGE_UPLOAD_MAX_BYTES, OWNER_FIELD('brandId'))
  @ApiOperation({ summary: 'Upload a brand logo' })
  @ApiDataResponse(BrandLogoUploadResponseDto, { status: 201 })
  @ApiErrorResponses(400, 401, 403, 413, 415)
  brandLogo(@UploadedFile() file: UploadedFileInput | undefined, @Body() body: BrandLogoUploadDto) {
    return this.uploads.brandLogo(file, body.brandId);
  }

  @Post('banner')
  @HttpCode(201)
  @RequirePermission('homepage.manage')
  @FileUpload(IMAGE_UPLOAD_MAX_BYTES, {
    variant: { type: 'string', description: 'desktop (1600 px) or mobile (800 px)' },
    ...OWNER_FIELD('bannerId'),
  })
  @ApiOperation({ summary: 'Upload a homepage banner image' })
  @ApiDataResponse(BannerUploadResponseDto, { status: 201 })
  @ApiErrorResponses(400, 401, 403, 413, 415)
  banner(@UploadedFile() file: UploadedFileInput | undefined, @Body() body: BannerUploadDto) {
    return this.uploads.banner(file, body.variant, body.bannerId);
  }
}
