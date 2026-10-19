import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { IsObjectId } from '../../../common/validation/validators.js';

/* Multipart fields sent next to `file`. An owner id ties the stored key to the thing it belongs to;
 * left out (a product or category that isn't saved yet), a new id is made and returned, and the
 * create request then sends it as `id`. */

export class ProductImageUploadDto {
  @ApiPropertyOptional() @IsOptional() @IsObjectId() productId?: string;
}

export class CategoryImageUploadDto {
  @ApiPropertyOptional() @IsOptional() @IsObjectId() categoryId?: string;
}

export class BrandLogoUploadDto {
  @ApiPropertyOptional() @IsOptional() @IsObjectId() brandId?: string;
}

export class BannerUploadDto {
  @ApiProperty({ enum: ['desktop', 'mobile'] })
  @IsIn(['desktop', 'mobile'], { message: 'Choose desktop or mobile.' })
  variant!: 'desktop' | 'mobile';

  @ApiPropertyOptional({ description: 'The banner this image is for; left out for a new banner.' })
  @IsOptional()
  @IsObjectId()
  bannerId?: string;
}

export class ProductImageUploadResponseDto {
  @ApiProperty({ example: 'products/66f0c0ffee0000000000a001/66f0c0ffee0000000000f001' }) key!: string;
  @ApiProperty() productId!: string;
}

export class CategoryImageUploadResponseDto {
  @ApiProperty({ example: 'categories/66f0c0ffee0000000000a001/image.webp' }) key!: string;
  @ApiProperty() categoryId!: string;
}

export class BrandLogoUploadResponseDto {
  @ApiProperty({ example: 'brands/66f0c0ffee0000000000a001/logo.webp' }) key!: string;
  @ApiProperty() brandId!: string;
}

export class BannerUploadResponseDto {
  @ApiProperty({ example: 'banners/66f0c0ffee0000000000a001/desktop.webp' }) key!: string;
  @ApiProperty() bannerId!: string;
}
