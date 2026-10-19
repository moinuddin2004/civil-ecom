import { PRODUCT_SORTS, type ProductSort } from '@aricon/shared';
import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/http/pagination.dto.js';
import {
  IsOptionalCsvList,
  IsOptionalQueryBoolean,
  IsOptionalText,
  IsSlug,
} from '../../../common/validation/validators.js';

const PRICE_MAX = 1_000_000_000;

function OptionalPrice() {
  return applyDecorators(
    ApiPropertyOptional({ minimum: 0, description: 'Integer PKR.' }),
    Type(() => Number),
    IsOptional(),
    IsInt({ message: 'Use a whole number of rupees.' }),
    Min(0, { message: 'Price cannot be negative.' }),
    Max(PRICE_MAX),
  );
}

/** `GET /api/products` (SPEC §7.2); mirrors `productListQuery` in shared. List filters are comma-separated. */
export class ProductListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'cement', description: 'Category slug; includes its sub-categories.' })
  @IsOptional()
  @IsSlug()
  category?: string;

  @ApiPropertyOptional({ example: 'lucky-cement,dg-cement', description: 'Brand slugs, comma-separated.' })
  @IsOptionalCsvList(30)
  brand?: string[];

  @ApiPropertyOptional({ example: 'opc', description: 'Search text (name and brand).' })
  @IsOptionalText(100)
  q?: string;

  @OptionalPrice()
  minPrice?: number;

  @OptionalPrice()
  maxPrice?: number;

  @ApiPropertyOptional({ example: 'OPC' })
  @IsOptionalCsvList()
  type?: string[];

  @ApiPropertyOptional({ example: '50 kg' })
  @IsOptionalCsvList()
  packSize?: string[];

  @ApiPropertyOptional()
  @IsOptionalCsvList()
  grade?: string[];

  @ApiPropertyOptional()
  @IsOptionalCsvList()
  colour?: string[];

  @ApiPropertyOptional()
  @IsOptionalCsvList()
  size?: string[];

  @ApiPropertyOptional({ description: 'Only products with stock: true/false.' })
  @IsOptionalQueryBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({ enum: PRODUCT_SORTS, default: 'relevance' })
  @IsOptional()
  @IsIn(PRODUCT_SORTS, { message: `Sort by one of: ${PRODUCT_SORTS.join(', ')}.` })
  sort?: ProductSort;
}

/** `GET /api/search/suggest?q=`. Shorter than 2 characters → empty suggestions, not an error. */
export class SuggestQueryDto {
  @ApiPropertyOptional({ example: 'luc', minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Use at most 100 characters.' })
  q?: string;
}
