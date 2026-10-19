import {
  MAX_BULK_TIERS,
  MAX_DESCRIPTION_LENGTH,
  MAX_PRODUCT_IMAGES,
  MAX_RELATED_PRODUCTS,
  MAX_SPECIFICATIONS,
  PRODUCT_STATUSES,
  STOCK_MOVEMENT_REASONS,
  UNITS,
  type AdminProductDTO,
  type AdminProductListItemDTO,
  type AdminVariantDTO,
  type ProductStatus,
  type StockMovementDTO,
  type StockMovementReason,
  type Unit,
} from '@aricon/shared';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/http/pagination.dto.js';
import {
  IsClearableText,
  IsMoney,
  IsObjectId,
  IsOptionalDateKey,
  IsOptionalQueryBoolean,
  IsOptionalText,
  IsRequiredText,
  IsSlug,
} from '../../../common/validation/validators.js';

/*
 * Admin product requests (SPEC §7.3 "Products and stock"); mirror `productCreateSchema`,
 * `productUpdateSchema`, `variantCreateSchema`, `variantUpdateSchema` and `stockAdjustmentSchema`.
 * The pricing rules (§6.1) are checked by the product model with the shared `validateVariantPricing`.
 */

const PRODUCT_IMAGE_KEY = /^products\/[a-f\d]{24}\/[a-f\d]{24}$/;

const toUpperTrimmed = Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));

function IsSku() {
  return applyDecorators(
    toUpperTrimmed,
    IsString({ message: 'Enter a SKU.' }),
    MaxLength(40, { message: 'Use at most 40 characters.' }),
    Matches(/^[A-Z0-9][A-Z0-9._-]+$/, { message: 'Use letters, numbers, dots, dashes or underscores (at least 2).' }),
  );
}

function IsStockCount() {
  return applyDecorators(IsInt({ message: 'Use a whole number.' }), Min(0), Max(1_000_000));
}

export class BulkTierInput {
  @ApiProperty({ example: 10 }) @IsInt({ message: 'Use a whole number.' }) minQty!: number;
  @ApiProperty({ example: 415 }) @IsInt({ message: 'Use whole rupees.' }) price!: number;
}

export class VariantOptionsInput {
  @ApiPropertyOptional({ example: '50 kg' }) @IsOptionalText(60) packSize?: string;
  @ApiPropertyOptional({ example: 'OPC 53' }) @IsOptionalText(60) grade?: string;
  @ApiPropertyOptional({ example: 'Ivory' }) @IsOptionalText(60) colour?: string;
  @ApiPropertyOptional({ example: '60×60 cm' }) @IsOptionalText(60) size?: string;
}

function BulkTiers(optional: boolean) {
  return applyDecorators(
    ApiProperty({ type: [BulkTierInput], maxItems: MAX_BULK_TIERS, required: !optional }),
    ...(optional ? [IsOptional()] : []),
    IsArray(),
    ArrayMaxSize(MAX_BULK_TIERS, { message: `Add at most ${MAX_BULK_TIERS} bulk tiers.` }),
    ValidateNested({ each: true }),
    Type(() => BulkTierInput),
  );
}

/** A new variant (with a product, or added later). `stock` needs `products.edit_stock`. */
export class VariantCreateInput {
  @ApiProperty({ example: 'LUCKY-OPC-50' }) @IsSku() sku!: string;
  @ApiProperty({ example: '50 kg bag' }) @IsRequiredText(1, 120, 'Label') label!: string;

  @ApiPropertyOptional({ type: VariantOptionsInput })
  @IsOptional()
  @ValidateNested()
  @Type(() => VariantOptionsInput)
  options?: VariantOptionsInput;

  @ApiProperty({ example: 450 }) @IsMoney() mrp!: number;
  @ApiProperty({ example: 425 }) @IsMoney() price!: number;

  @BulkTiers(true)
  bulkTiers?: BulkTierInput[];

  @ApiPropertyOptional({ description: 'Defaults to the store setting.' })
  @IsOptional()
  @IsStockCount()
  lowStockThreshold?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: 'Use true or false.' })
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0, description: 'Initial stock; needs products.edit_stock.' })
  @IsOptional()
  @IsStockCount()
  stock?: number;
}

/** Changes to an existing variant; price fields need `products.edit_price`; no `stock`. */
export class VariantUpdateInput {
  @ApiPropertyOptional() @IsOptional() @IsSku() sku?: string;
  @ApiPropertyOptional() @IsOptional() @IsRequiredText(1, 120, 'Label') label?: string;

  @ApiPropertyOptional({ type: VariantOptionsInput })
  @IsOptional()
  @ValidateNested()
  @Type(() => VariantOptionsInput)
  options?: VariantOptionsInput;

  @ApiPropertyOptional() @IsOptional() @IsMoney() mrp?: number;
  @ApiPropertyOptional() @IsOptional() @IsMoney() price?: number;

  @BulkTiers(true)
  bulkTiers?: BulkTierInput[];

  @ApiPropertyOptional() @IsOptional() @IsStockCount() lowStockThreshold?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean({ message: 'Use true or false.' }) isActive?: boolean;
}

export class VariantPatchInput extends VariantUpdateInput {
  @ApiProperty({ description: 'Which variant.' }) @IsObjectId() id!: string;
}

export class SpecificationInput {
  @ApiProperty({ example: 'Strength' }) @IsRequiredText(1, 60, 'Label') label!: string;
  @ApiProperty({ example: '53 N/mm²' }) @IsRequiredText(1, 200, 'Value') value!: string;
}

export class ProductImageInput {
  @ApiProperty({ example: 'products/66f0c0ffee0000000000a001/66f0c0ffee0000000000f001' })
  @IsString()
  @Matches(PRODUCT_IMAGE_KEY, { message: 'Upload the image again.' })
  key!: string;

  @ApiPropertyOptional({ default: '' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(150)
  alt?: string;
}

export class SeoInput {
  @ApiPropertyOptional({ maxLength: 70 }) @IsOptionalText(70) title?: string;
  @ApiPropertyOptional({ maxLength: 160 }) @IsOptionalText(160) description?: string;
}

const ListOf = <T>(type: () => new () => T, max: number, message: string, optional: boolean) =>
  applyDecorators(
    ApiProperty({ type: [type()], maxItems: max, required: !optional }),
    ...(optional ? [IsOptional()] : []),
    IsArray(),
    ArrayMaxSize(max, { message }),
    ValidateNested({ each: true }),
    Type(type),
  );

function RelatedIds(optional: boolean) {
  return applyDecorators(
    ApiProperty({ type: [String], maxItems: MAX_RELATED_PRODUCTS, required: !optional }),
    ...(optional ? [IsOptional()] : []),
    IsArray(),
    ArrayMaxSize(MAX_RELATED_PRODUCTS, { message: `Add at most ${MAX_RELATED_PRODUCTS} related products.` }),
    ArrayUnique({ message: 'Each related product can be added once.' }),
    IsObjectId({ each: true }),
  );
}

export class CreateProductDto {
  @ApiPropertyOptional({ description: 'The id images were uploaded under, if any.' })
  @IsOptional()
  @IsObjectId()
  id?: string;

  @ApiProperty({ example: 'Lucky OPC Cement' }) @IsRequiredText(3, 150, 'Name') name!: string;
  @ApiPropertyOptional({ description: 'Made from the name when left out.' }) @IsOptional() @IsSlug() slug?: string;
  @ApiProperty() @IsObjectId() brandId!: string;
  @ApiProperty() @IsObjectId() categoryId!: string;
  @ApiPropertyOptional({ example: 'OPC' }) @IsOptionalText(60) type?: string;
  @ApiProperty({ enum: UNITS }) @IsIn(UNITS, { message: 'Choose a unit.' }) unit!: Unit;

  @ApiPropertyOptional({ description: 'Markdown.' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH, { message: 'Description is too long.' })
  description?: string;

  @ListOf(() => SpecificationInput, MAX_SPECIFICATIONS, `Add at most ${MAX_SPECIFICATIONS} rows.`, true)
  specifications?: SpecificationInput[];

  @ListOf(() => ProductImageInput, MAX_PRODUCT_IMAGES, `Add at most ${MAX_PRODUCT_IMAGES} images.`, true)
  images?: ProductImageInput[];

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean({ message: 'Use true or false.' }) isFeatured?: boolean;

  @RelatedIds(true)
  relatedProductIds?: string[];

  @ApiPropertyOptional({ type: SeoInput }) @IsOptional() @ValidateNested() @Type(() => SeoInput) seo?: SeoInput;

  @ApiPropertyOptional({ enum: ['active', 'hidden'], default: 'hidden' })
  @IsOptional()
  @IsIn(['active', 'hidden'], { message: 'New products are active or hidden.' })
  status?: 'active' | 'hidden';

  @ApiProperty({ type: [VariantCreateInput], minItems: 1, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one variant.' })
  @ArrayMaxSize(50, { message: 'Add at most 50 variants.' })
  @ValidateNested({ each: true })
  @Type(() => VariantCreateInput)
  variants!: VariantCreateInput[];
}

/** Details and per-variant changes. Status has its own endpoint; `stock` is rejected. */
export class UpdateProductDto {
  @ApiPropertyOptional() @IsOptional() @IsRequiredText(3, 150, 'Name') name?: string;
  @ApiPropertyOptional() @IsOptional() @IsSlug() slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsObjectId() brandId?: string;
  @ApiPropertyOptional() @IsOptional() @IsObjectId() categoryId?: string;
  @ApiPropertyOptional({ type: String, nullable: true }) @IsClearableText(60) type?: string | null;
  @ApiPropertyOptional({ enum: UNITS }) @IsOptional() @IsIn(UNITS, { message: 'Choose a unit.' }) unit?: Unit;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH, { message: 'Description is too long.' })
  description?: string;

  @ListOf(() => SpecificationInput, MAX_SPECIFICATIONS, `Add at most ${MAX_SPECIFICATIONS} rows.`, true)
  specifications?: SpecificationInput[];

  @ListOf(() => ProductImageInput, MAX_PRODUCT_IMAGES, `Add at most ${MAX_PRODUCT_IMAGES} images.`, true)
  images?: ProductImageInput[];

  @ApiPropertyOptional() @IsOptional() @IsBoolean({ message: 'Use true or false.' }) isFeatured?: boolean;

  @RelatedIds(true)
  relatedProductIds?: string[];

  @ApiPropertyOptional({ type: SeoInput }) @IsOptional() @ValidateNested() @Type(() => SeoInput) seo?: SeoInput;

  @ListOf(() => VariantPatchInput, 50, 'At most 50 variants.', true)
  variants?: VariantPatchInput[];
}

export class ProductStatusDto {
  @ApiProperty({ enum: PRODUCT_STATUSES })
  @IsIn(PRODUCT_STATUSES, { message: 'Use active, hidden or archived.' })
  status!: ProductStatus;
}

export class StockAdjustmentDto {
  @ApiProperty() @IsObjectId() variantId!: string;

  @ApiProperty({ example: -3, description: 'Positive adds, negative removes; not 0.' })
  @IsInt({ message: 'Use a whole number.' })
  @Min(-1_000_000)
  @Max(1_000_000)
  change!: number;

  @ApiProperty({ example: 'Damaged bags returned to supplier' })
  @IsRequiredText(3, 300, 'Reason')
  reason!: string;
}

export class AdminProductListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Name, brand or SKU.' }) @IsOptionalText(100) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsObjectId() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsObjectId() brandId?: string;

  @ApiPropertyOptional({ enum: [...PRODUCT_STATUSES, 'all'], description: 'Default: active and hidden (archived left out).' })
  @IsOptional()
  @IsIn([...PRODUCT_STATUSES, 'all'])
  status?: ProductStatus | 'all';

  @ApiPropertyOptional({ description: 'Only products with a variant at or below its low-stock threshold.' })
  @IsOptionalQueryBoolean()
  lowStock?: boolean;

  @ApiPropertyOptional({ example: 'updatedAt:desc' })
  @IsOptional()
  @Matches(/^(updatedAt|createdAt|name|minPrice|totalStock)(:(asc|desc))?$/, {
    message: 'Sort by updatedAt, createdAt, name, minPrice or totalStock (asc or desc).',
  })
  sort?: string;
}

export class StockMovementListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsSku() sku?: string;
  @ApiPropertyOptional() @IsOptional() @IsObjectId() productId?: string;

  @ApiPropertyOptional({ enum: STOCK_MOVEMENT_REASONS })
  @IsOptional()
  @IsIn(STOCK_MOVEMENT_REASONS)
  reason?: StockMovementReason;

  @ApiPropertyOptional({ example: '2026-09-01' }) @IsOptionalDateKey() from?: string;
  @ApiPropertyOptional({ example: '2026-09-30' }) @IsOptionalDateKey() to?: string;
}

/* Responses */

export class AdminVariantDto implements AdminVariantDTO {
  @ApiProperty() id!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: VariantOptionsInput }) options!: VariantOptionsInput;
  @ApiProperty() mrp!: number;
  @ApiProperty() price!: number;
  @ApiProperty({ type: [BulkTierInput] }) bulkTiers!: BulkTierInput[];
  @ApiProperty() stock!: number;
  @ApiProperty() lowStockThreshold!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() isLowStock!: boolean;
}

export class AdminProductImageDto {
  @ApiProperty() id!: string;
  @ApiProperty() key!: string;
  @ApiProperty() alt!: string;
}

export class AdminProductSeoDto {
  @ApiProperty({ type: String, nullable: true }) title!: string | null;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
}

export class AdminProductDto implements AdminProductDTO {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() brandId!: string;
  @ApiProperty() brandName!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty({ type: String, nullable: true }) type!: string | null;
  @ApiProperty({ enum: UNITS }) unit!: Unit;
  @ApiProperty() description!: string;
  @ApiProperty({ type: [SpecificationInput] }) specifications!: SpecificationInput[];
  @ApiProperty({ type: [AdminProductImageDto] }) images!: AdminProductImageDto[];
  @ApiProperty({ type: [AdminVariantDto] }) variants!: AdminVariantDto[];
  @ApiProperty() isFeatured!: boolean;
  @ApiProperty({ type: [String] }) relatedProductIds!: string[];
  @ApiProperty({ type: AdminProductSeoDto }) seo!: AdminProductSeoDto;
  @ApiProperty({ enum: PRODUCT_STATUSES }) status!: ProductStatus;
  @ApiProperty() minPrice!: number;
  @ApiProperty() maxPrice!: number;
  @ApiProperty() totalStock!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class AdminProductListItemDto implements AdminProductListItemDTO {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) imageKey!: string | null;
  @ApiProperty() brandName!: string;
  @ApiProperty() categoryName!: string;
  @ApiProperty() minPrice!: number;
  @ApiProperty() maxPrice!: number;
  @ApiProperty() totalStock!: number;
  @ApiProperty() hasLowStock!: boolean;
  @ApiProperty({ enum: PRODUCT_STATUSES }) status!: ProductStatus;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class StockMovementDto implements StockMovementDTO {
  @ApiProperty() id!: string;
  @ApiProperty({ format: 'date-time' }) at!: string;
  @ApiProperty() productId!: string;
  @ApiProperty({ type: String, nullable: true }) productName!: string | null;
  @ApiProperty() variantId!: string;
  @ApiProperty() sku!: string;
  @ApiProperty({ description: '+ in, − out.' }) change!: number;
  @ApiProperty() stockAfter!: number;
  @ApiProperty({ enum: STOCK_MOVEMENT_REASONS }) reason!: StockMovementReason;
  @ApiProperty({ type: String, nullable: true, enum: ['order', 'import'] }) refType!: 'order' | 'import' | null;
  @ApiProperty({ type: String, nullable: true }) refId!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Order number for order movements.' }) refLabel!: string | null;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty({ type: String, nullable: true }) byUserName!: string | null;
}
