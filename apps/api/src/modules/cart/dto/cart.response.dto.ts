import {
  UNITS,
  type CartIssue,
  type CartIssueCode,
  type CartLineIssue,
  type CartLineIssueCode,
  type NextTier,
  type PricedCart,
  type PricedCartLine,
  type Unit,
} from '@aricon/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/* Swagger models for `PricedCart` (shared `computeCart()`), returned by every cart endpoint. */

const LINE_ISSUES: CartLineIssueCode[] = ['PRODUCT_UNAVAILABLE', 'OUT_OF_STOCK', 'QTY_EXCEEDS_STOCK'];
const CART_ISSUES: CartIssueCode[] = [...LINE_ISSUES, 'AREA_NOT_SERVICEABLE', 'EMPTY_CART'];

export class CartLineIssueDto implements CartLineIssue {
  @ApiProperty({ enum: LINE_ISSUES }) code!: CartLineIssueCode;
  @ApiProperty({ example: 'Only 6 in stock.' }) message!: string;
  @ApiPropertyOptional({ description: 'For QTY_EXCEEDS_STOCK: the quantity to offer ("Set to 6").' }) maxQty?: number;
}

export class NextTierDto implements NextTier {
  @ApiProperty({ example: 50 }) minQty!: number;
  @ApiProperty({ example: 395 }) price!: number;
  @ApiProperty({ example: 3, description: 'Units still needed ("Add 3 more to pay Rs 395 each").' }) qtyNeeded!: number;
}

export class PricedCartLineDto implements PricedCartLine {
  @ApiProperty() productId!: string;
  @ApiProperty() variantId!: string;
  @ApiProperty({ example: 47 }) qty!: number;
  @ApiProperty({ type: String, nullable: true }) slug!: string | null;
  @ApiProperty() productName!: string;
  @ApiProperty() brandName!: string;
  @ApiProperty() variantLabel!: string;
  @ApiProperty({ type: String, nullable: true }) sku!: string | null;
  @ApiProperty({ enum: UNITS, nullable: true }) unit!: Unit | null;
  @ApiProperty({ type: String, nullable: true }) imageKey!: string | null;
  @ApiProperty() mrp!: number;
  @ApiProperty({ description: 'Variant price before bulk tiers.' }) basePrice!: number;
  @ApiProperty({ description: 'Price per unit after the bulk tier.' }) unitPrice!: number;
  @ApiProperty({ type: Number, nullable: true }) appliedTierMinQty!: number | null;
  @ApiProperty() lineTotal!: number;
  @ApiProperty() savings!: number;
  @ApiProperty({ type: NextTierDto, nullable: true }) nextTier!: NextTierDto | null;
  @ApiProperty() stock!: number;
  @ApiProperty({ type: CartLineIssueDto, nullable: true }) issue!: CartLineIssueDto | null;
}

export class CartIssueDto implements CartIssue {
  @ApiProperty({ enum: CART_ISSUES }) code!: CartIssueCode;
  @ApiProperty() message!: string;
  @ApiPropertyOptional() variantId?: string;
}

export class CartAreaDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isServiceable!: boolean;
  @ApiProperty({ type: Number, nullable: true }) freeDeliveryAbove!: number | null;
}

export class PricedCartDto implements PricedCart {
  @ApiProperty({ type: [PricedCartLineDto] }) lines!: PricedCartLineDto[];
  @ApiProperty({ description: 'Units across lines that can be bought.' }) itemCount!: number;
  @ApiProperty() subtotal!: number;
  @ApiProperty() savings!: number;
  @ApiProperty({ type: Number, nullable: true, description: 'null until a serviceable area is chosen.' })
  deliveryFee!: number | null;
  @ApiProperty() total!: number;
  @ApiProperty({ type: Number, nullable: true }) amountToFreeDelivery!: number | null;
  @ApiProperty({ type: CartAreaDto, nullable: true }) area!: CartAreaDto | null;
  @ApiProperty({ type: [CartIssueDto] }) issues!: CartIssueDto[];
  @ApiProperty({ description: 'No issues, at least one line and a serviceable area.' }) canCheckout!: boolean;
}
