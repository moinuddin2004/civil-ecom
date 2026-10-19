import { MAX_BANNERS, MAX_HOMEPAGE_PRODUCTS, PRODUCT_STATUSES, type AdminHomepageDTO, type ProductStatus } from '@aricon/shared';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsObjectId, IsRequiredText, IsSortOrder } from '../../../../common/validation/validators.js';

/* `PUT /api/admin/homepage` (SPEC §5.13, §10.10); mirrors `homepageSchema` in shared. */

const DESKTOP_KEY = /^banners\/[a-f\d]{24}\/desktop\.webp$/;
const MOBILE_KEY = /^banners\/[a-f\d]{24}\/mobile\.webp$/;
/** A path on this site (`/category/cement`, not `//evil.com`) or an https URL. */
const BANNER_LINK = /^(\/(?!\/)|https:\/\/)/;

export class BannerInput {
  @ApiProperty({ description: 'The id the images were uploaded under.' })
  @IsObjectId()
  id!: string;

  @ApiProperty({ example: 'banners/66f0c0ffee0000000000e001/desktop.webp' })
  @IsString()
  @Matches(DESKTOP_KEY, { message: 'Upload the desktop image again.' })
  desktopKey!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(MOBILE_KEY, { message: 'Upload the mobile image again.' })
  mobileKey?: string | null;

  @ApiProperty({ example: 'Monsoon offer on waterproofing' })
  @IsRequiredText(1, 150, 'Alt text')
  alt!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '/category/waterproofing' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(BANNER_LINK, { message: 'Use a path like /category/cement or an https:// link.' })
  link?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: 'Use true or false.' })
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsSortOrder()
  sortOrder?: number;
}

function ProductIdList(label: string) {
  return applyDecorators(
    ApiProperty({ type: [String], maxItems: MAX_HOMEPAGE_PRODUCTS, description: `${label}, in display order.` }),
    IsArray(),
    ArrayMaxSize(MAX_HOMEPAGE_PRODUCTS, { message: `Pick at most ${MAX_HOMEPAGE_PRODUCTS} products.` }),
    ArrayUnique({ message: 'Each product can be picked once.' }),
    IsObjectId({ each: true }),
  );
}

export class UpdateHomepageDto {
  @ApiProperty({ type: [BannerInput], maxItems: MAX_BANNERS })
  @IsArray()
  @ArrayMaxSize(MAX_BANNERS, { message: `Add at most ${MAX_BANNERS} banners.` })
  @ValidateNested({ each: true })
  @Type(() => BannerInput)
  banners!: BannerInput[];

  @ProductIdList('Featured products')
  featuredProductIds!: string[];

  @ProductIdList('Deals')
  dealProductIds!: string[];
}

export class AdminBannerDto {
  @ApiProperty() id!: string;
  @ApiProperty() desktopKey!: string;
  @ApiProperty({ type: String, nullable: true }) mobileKey!: string | null;
  @ApiProperty() alt!: string;
  @ApiProperty({ type: String, nullable: true }) link!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() sortOrder!: number;
}

export class PickedProductDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) imageKey!: string | null;
  @ApiProperty({ enum: PRODUCT_STATUSES, description: 'Hidden/archived picks are kept but not shown.' }) status!: ProductStatus;
}

export class AdminHomepageDto implements AdminHomepageDTO {
  @ApiProperty({ type: [AdminBannerDto] }) banners!: AdminBannerDto[];
  @ApiProperty({ type: [PickedProductDto] }) featuredProducts!: PickedProductDto[];
  @ApiProperty({ type: [PickedProductDto] }) dealProducts!: PickedProductDto[];
}
