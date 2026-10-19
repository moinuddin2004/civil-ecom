import { CART_MAX_LINES, QTY_MAX, type CartItem } from '@aricon/shared';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { IsObjectId, IsQty } from '../../../common/validation/validators.js';

/* Cart requests (SPEC §6.3, §7.2 "Cart"); mirror the cart schemas in shared. */

const TOO_MANY_LINES = `A cart can hold up to ${CART_MAX_LINES} different items.`;

export class CartItemDto implements CartItem {
  @ApiProperty({ example: '66f0c0ffee0000000000a001' })
  @IsObjectId()
  productId!: string;

  @ApiProperty({ example: '66f0c0ffee0000000000b001' })
  @IsObjectId()
  variantId!: string;

  @ApiProperty({ minimum: 1, maximum: QTY_MAX, example: 10 })
  @IsQty()
  qty!: number;
}

function CartItems() {
  return applyDecorators(
    ApiProperty({ type: [CartItemDto], maxItems: CART_MAX_LINES }),
    IsArray({ message: 'Send the cart items as a list.' }),
    ArrayMaxSize(CART_MAX_LINES, { message: TOO_MANY_LINES }),
    ValidateNested({ each: true }),
    Type(() => CartItemDto),
  );
}

/** Optional delivery area for the estimate (`aricon_area` cookie). */
export class CartAreaQueryDto {
  @ApiPropertyOptional({ description: 'Delivery area for the fee estimate.' })
  @IsOptional()
  @IsObjectId()
  areaId?: string;
}

export class CartQuoteDto {
  @CartItems()
  items!: CartItemDto[];

  @ApiPropertyOptional({ description: 'Delivery area for the fee estimate.' })
  @IsOptional()
  @IsObjectId()
  areaId?: string;
}

export class MergeCartDto {
  @CartItems()
  items!: CartItemDto[];
}

/** `qty: 0` removes the line. */
export class SetCartItemDto {
  @ApiProperty()
  @IsObjectId()
  variantId!: string;

  @ApiProperty({ minimum: 0, maximum: QTY_MAX, description: '0 removes the line.' })
  @IsQty(0)
  qty!: number;
}
