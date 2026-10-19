import {
  UNITS,
  VARIANT_OPTION_KEYS,
  type BannerDTO,
  type BrandDTO,
  type BrandFacet,
  type BreadcrumbDTO,
  type CategoryNode,
  type CategoryPageDTO,
  type CategoryTileDTO,
  type FacetValue,
  type FilterKey,
  type HomeDTO,
  type ProductCard,
  type ProductDetail,
  type ProductFacets,
  type ProductImageDTO,
  type ProductVariantDTO,
  type SearchSuggestDTO,
  type Unit,
  type VariantOptionKey,
} from '@aricon/shared';
import { ApiProperty } from '@nestjs/swagger';

/*
 * Swagger models for the public catalog (SPEC §7.2). Each class `implements` the shared DTO the web
 * app reads, so the documentation can't drift from the real response type.
 */

const nullableString = { type: String, nullable: true } as const;

export class ProductCardDto implements ProductCard {
  @ApiProperty({ example: '66f0c0ffee0000000000a001' }) id!: string;
  @ApiProperty({ example: 'lucky-opc-cement' }) slug!: string;
  @ApiProperty({ example: 'Lucky OPC Cement' }) name!: string;
  @ApiProperty({ example: 'Lucky Cement' }) brandName!: string;
  @ApiProperty({ enum: UNITS }) unit!: Unit;
  @ApiProperty({ ...nullableString, description: 'Image prefix; the web app builds the URL.' }) imageKey!: string | null;
  @ApiProperty({ example: 1450, description: 'Integer PKR.' }) minPrice!: number;
  @ApiProperty({ example: 1450 }) maxPrice!: number;
  @ApiProperty({ example: 1500 }) mrpOfMin!: number;
  @ApiProperty({ type: Number, nullable: true, example: 1420 }) lowestTierPrice!: number | null;
  @ApiProperty() inStock!: boolean;
  @ApiProperty({ example: 1 }) variantCount!: number;
  @ApiProperty() defaultVariantId!: string;
  @ApiProperty({ type: Number, nullable: true, description: 'Set when the default variant is running low.' })
  lowStockCount!: number | null;
}

export class BreadcrumbDto implements BreadcrumbDTO {
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}

export class RefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}

export class BulkTierDto {
  @ApiProperty({ example: 50 }) minQty!: number;
  @ApiProperty({ example: 1420 }) price!: number;
}

export class VariantOptionsDto implements Partial<Record<VariantOptionKey, string>> {
  @ApiProperty({ required: false, example: '50 kg' }) packSize?: string;
  @ApiProperty({ required: false }) grade?: string;
  @ApiProperty({ required: false }) colour?: string;
  @ApiProperty({ required: false }) size?: string;
}

export class ProductVariantDto implements ProductVariantDTO {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'LUCKY-OPC-50' }) sku!: string;
  @ApiProperty({ example: '50 kg bag' }) label!: string;
  @ApiProperty({ type: VariantOptionsDto }) options!: Partial<Record<VariantOptionKey, string>>;
  @ApiProperty() mrp!: number;
  @ApiProperty() price!: number;
  @ApiProperty({ type: [BulkTierDto] }) bulkTiers!: BulkTierDto[];
  @ApiProperty() stock!: number;
  @ApiProperty() lowStockThreshold!: number;
}

export class ProductImageDto implements ProductImageDTO {
  @ApiProperty() id!: string;
  @ApiProperty() key!: string;
  @ApiProperty() alt!: string;
}

export class SpecificationDto {
  @ApiProperty({ example: 'Strength' }) label!: string;
  @ApiProperty({ example: '42.5 N/mm²' }) value!: string;
}

export class ProductSeoDto {
  @ApiProperty(nullableString) title!: string | null;
  @ApiProperty(nullableString) description!: string | null;
}

export class ProductDetailDto implements ProductDetail {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: RefDto }) brand!: RefDto;
  @ApiProperty({ type: RefDto }) category!: RefDto;
  @ApiProperty({ type: [BreadcrumbDto], description: 'Parent (if any), then the category.' }) breadcrumbs!: BreadcrumbDto[];
  @ApiProperty(nullableString) type!: string | null;
  @ApiProperty({ enum: UNITS }) unit!: Unit;
  @ApiProperty({ description: 'Markdown.' }) description!: string;
  @ApiProperty({ type: [SpecificationDto] }) specifications!: SpecificationDto[];
  @ApiProperty({ type: [ProductImageDto] }) images!: ProductImageDto[];
  @ApiProperty({ type: [ProductVariantDto], description: 'Active variants only.' }) variants!: ProductVariantDto[];
  @ApiProperty({ enum: VARIANT_OPTION_KEYS, isArray: true, description: 'Options that differ between variants.' })
  optionKeys!: VariantOptionKey[];
  @ApiProperty() minPrice!: number;
  @ApiProperty() maxPrice!: number;
  @ApiProperty({ type: ProductSeoDto }) seo!: ProductSeoDto;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class FacetValueDto implements FacetValue {
  @ApiProperty({ example: '50 kg' }) value!: string;
  @ApiProperty({ example: 12 }) count!: number;
}

export class BrandFacetDto implements BrandFacet {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() count!: number;
}

export class PriceRangeDto {
  @ApiProperty() min!: number;
  @ApiProperty() max!: number;
}

export class FacetValuesDto implements Record<FilterKey, FacetValue[]> {
  @ApiProperty({ type: [FacetValueDto] }) type!: FacetValueDto[];
  @ApiProperty({ type: [FacetValueDto] }) packSize!: FacetValueDto[];
  @ApiProperty({ type: [FacetValueDto] }) grade!: FacetValueDto[];
  @ApiProperty({ type: [FacetValueDto] }) colour!: FacetValueDto[];
  @ApiProperty({ type: [FacetValueDto] }) size!: FacetValueDto[];
}

export class ProductFacetsDto implements ProductFacets {
  @ApiProperty({ type: [BrandFacetDto] }) brands!: BrandFacetDto[];
  @ApiProperty({ type: PriceRangeDto, nullable: true, description: 'null when nothing matches.' })
  price!: PriceRangeDto | null;
  @ApiProperty({ type: FacetValuesDto }) values!: FacetValuesDto;
}

export class CategoryNodeDto implements CategoryNode {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Cement' }) name!: string;
  @ApiProperty({ example: 'cement' }) slug!: string;
  @ApiProperty(nullableString) description!: string | null;
  @ApiProperty(nullableString) imageKey!: string | null;
  @ApiProperty({ description: 'Active products here and in sub-categories.' }) productCount!: number;
  @ApiProperty({ type: () => [CategoryNodeDto] }) children!: CategoryNodeDto[];
}

export class CategoryPageDto implements CategoryPageDTO {
  @ApiProperty({ type: CategoryNodeDto }) category!: CategoryNodeDto;
  @ApiProperty({ type: RefDto, nullable: true }) parent!: RefDto | null;
  @ApiProperty({ type: [CategoryNodeDto], description: 'Own sub-categories, or siblings for a sub-category.' })
  children!: CategoryNodeDto[];
  @ApiProperty({ type: [BreadcrumbDto] }) breadcrumbs!: BreadcrumbDto[];
}

export class BrandDto implements BrandDTO {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Lucky Cement' }) name!: string;
  @ApiProperty({ example: 'lucky-cement' }) slug!: string;
  @ApiProperty(nullableString) logoKey!: string | null;
}

export class BannerDto implements BannerDTO {
  @ApiProperty() id!: string;
  @ApiProperty() desktopKey!: string;
  @ApiProperty(nullableString) mobileKey!: string | null;
  @ApiProperty() alt!: string;
  @ApiProperty({ ...nullableString, description: 'Site path or https URL.' }) link!: string | null;
}

export class CategoryTileDto implements CategoryTileDTO {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty(nullableString) imageKey!: string | null;
  @ApiProperty() productCount!: number;
}

export class HomeDto implements HomeDTO {
  @ApiProperty({ type: [BannerDto] }) banners!: BannerDto[];
  @ApiProperty({ type: [CategoryTileDto] }) categoryTiles!: CategoryTileDto[];
  @ApiProperty({ type: [ProductCardDto] }) featured!: ProductCardDto[];
  @ApiProperty({ type: [ProductCardDto] }) deals!: ProductCardDto[];
  @ApiProperty({ type: [ProductCardDto] }) newArrivals!: ProductCardDto[];
  @ApiProperty({ type: [BrandDto] }) brands!: BrandDto[];
}

export class SuggestProductDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() brandName!: string;
  @ApiProperty(nullableString) imageKey!: string | null;
  @ApiProperty() minPrice!: number;
  @ApiProperty({ enum: UNITS }) unit!: Unit;
}

export class NameSlugDto {
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}

export class SearchSuggestDto implements SearchSuggestDTO {
  @ApiProperty({ type: [SuggestProductDto] }) products!: SuggestProductDto[];
  @ApiProperty({ type: [NameSlugDto] }) categories!: NameSlugDto[];
  @ApiProperty({ type: [NameSlugDto] }) brands!: NameSlugDto[];
}
