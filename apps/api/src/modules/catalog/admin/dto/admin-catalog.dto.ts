import { CATALOG_STATUSES, type AdminBrandDTO, type AdminCategoryDTO, type CatalogStatus } from '@aricon/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import {
  IsClearableText,
  IsObjectId,
  IsOptionalText,
  IsRequiredText,
  IsSlug,
  IsSortOrder,
} from '../../../../common/validation/validators.js';

/* Admin categories and brands (SPEC §7.3 "Catalog"); mirror the shared catalog schemas. */

/** Upload keys are made by the upload endpoints; only their exact shape is accepted here. */
export const CATEGORY_IMAGE_KEY = /^categories\/[a-f\d]{24}\/image\.webp$/;
export const BRAND_LOGO_KEY = /^brands\/[a-f\d]{24}\/logo\.webp$/;

const statusMessage = { message: 'Use active or hidden.' };

export class CreateCategoryDto {
  @ApiPropertyOptional({ description: 'Id chosen in advance so an image can be uploaded before saving.' })
  @IsOptional()
  @IsObjectId()
  id?: string;

  @ApiProperty({ example: 'Cement & plaster' })
  @IsRequiredText(2, 80, 'Name')
  name!: string;

  @ApiPropertyOptional({ example: 'cement-plaster', description: 'Made from the name when left out.' })
  @IsOptional()
  @IsSlug()
  slug?: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'A top-level category; null = top level.' })
  @IsOptional()
  @IsObjectId()
  parentId?: string | null;

  @ApiPropertyOptional()
  @IsOptionalText(2_000)
  description?: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'categories/66f0c0ffee0000000000c001/image.webp' })
  @IsOptional()
  @IsString()
  @Matches(CATEGORY_IMAGE_KEY, { message: 'Upload the image again.' })
  imageKey?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsSortOrder()
  sortOrder?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: 'Use true or false.' })
  showOnHome?: boolean;

  @ApiPropertyOptional({ enum: CATALOG_STATUSES, default: 'active' })
  @IsOptional()
  @IsIn(CATALOG_STATUSES, statusMessage)
  status?: CatalogStatus;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsRequiredText(2, 80, 'Name')
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsSlug()
  slug?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsObjectId()
  parentId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'null or "" clears it.' })
  @IsClearableText(2_000)
  description?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(CATEGORY_IMAGE_KEY, { message: 'Upload the image again.' })
  imageKey?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsSortOrder()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'Use true or false.' })
  showOnHome?: boolean;

  @ApiPropertyOptional({ enum: CATALOG_STATUSES })
  @IsOptional()
  @IsIn(CATALOG_STATUSES, statusMessage)
  status?: CatalogStatus;
}

export class CreateBrandDto {
  @ApiPropertyOptional({ description: 'Id chosen in advance so a logo can be uploaded before saving.' })
  @IsOptional()
  @IsObjectId()
  id?: string;

  @ApiProperty({ example: 'Lucky Cement' })
  @IsRequiredText(2, 80, 'Name')
  name!: string;

  @ApiPropertyOptional({ example: 'lucky-cement' })
  @IsOptional()
  @IsSlug()
  slug?: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'brands/66f0c0ffee0000000000d001/logo.webp' })
  @IsOptional()
  @IsString()
  @Matches(BRAND_LOGO_KEY, { message: 'Upload the logo again.' })
  logoKey?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsSortOrder()
  sortOrder?: number;

  @ApiPropertyOptional({ enum: CATALOG_STATUSES, default: 'active' })
  @IsOptional()
  @IsIn(CATALOG_STATUSES, statusMessage)
  status?: CatalogStatus;
}

export class UpdateBrandDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsRequiredText(2, 80, 'Name')
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsSlug()
  slug?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(BRAND_LOGO_KEY, { message: 'Upload the logo again.' })
  logoKey?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsSortOrder()
  sortOrder?: number;

  @ApiPropertyOptional({ enum: CATALOG_STATUSES })
  @IsOptional()
  @IsIn(CATALOG_STATUSES, statusMessage)
  status?: CatalogStatus;
}

export class AdminCategoryDto implements AdminCategoryDTO {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ type: String, nullable: true }) parentId!: string | null;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, nullable: true }) imageKey!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() showOnHome!: boolean;
  @ApiProperty({ enum: CATALOG_STATUSES }) status!: CatalogStatus;
  @ApiProperty({ description: 'Active products here and in sub-categories.' }) productCount!: number;
}

export class AdminBrandDto implements AdminBrandDTO {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ type: String, nullable: true }) logoKey!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ enum: CATALOG_STATUSES }) status!: CatalogStatus;
  @ApiProperty({ description: 'Active products of this brand.' }) productCount!: number;
}
