import {
  ACTOR_TYPES,
  CART_MAX_LINES,
  CUSTOMER_NOTE_MAX,
  INTERNAL_NOTE_MAX,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type ActorType,
  type AdminOrderDTO,
  type AdminOrderListItemDTO,
  type AdminOrderProductOptionDTO,
  type AdminReceiptDTO,
  type AdminStatusHistoryEntryDTO,
  type FileLinkDTO,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from '@aricon/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/http/pagination.dto.js';
import {
  IsMoney,
  IsObjectId,
  IsOptionalCsvList,
  IsOptionalDateKey,
  IsOptionalText,
  IsRequiredText,
} from '../../../../common/validation/validators.js';
import { CartItemDto } from '../../../cart/dto/cart.request.dto.js';
import { PricedCartDto } from '../../../cart/dto/cart.response.dto.js';
import { OrderItemDto, ReceiptDto, ShippingAddressDto } from '../../dto/order.response.dto.js';

/* Admin order requests and responses (SPEC §7.3 "Orders"); mirror the shared order schemas. */


export class AdminOrderListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'NEW,CONFIRMED', description: 'One or more statuses, comma-separated.' })
  @IsOptionalCsvList(ORDER_STATUSES.length, 20)
  @IsIn(ORDER_STATUSES, { each: true, message: `Use statuses from: ${ORDER_STATUSES.join(', ')}.` })
  status?: OrderStatus[];

  @ApiPropertyOptional({ enum: PAYMENT_STATUSES })
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: '2026-09-01', description: 'Karachi date, inclusive.' })
  @IsOptionalDateKey()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'Karachi date, inclusive.' })
  @IsOptionalDateKey()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObjectId()
  areaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObjectId()
  riderId?: string;

  @ApiPropertyOptional({ description: 'Order number, phone (any format) or customer name.' })
  @IsOptionalText(100)
  q?: string;

  @ApiPropertyOptional({ example: 'createdAt:desc', description: 'createdAt | total | orderNumber, then :asc or :desc.' })
  @IsOptional()
  @Matches(/^(createdAt|total|orderNumber)(:(asc|desc))?$/, { message: 'Sort by createdAt, total or orderNumber (asc or desc).' })
  sort?: string;
}

export class AdminOrderListItemDto implements AdminOrderListItemDTO {
  @ApiProperty() id!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty() customerName!: string;
  @ApiProperty() customerPhone!: string;
  @ApiProperty() areaName!: string;
  @ApiProperty() total!: number;
  @ApiProperty({ enum: PAYMENT_METHODS }) paymentMethod!: PaymentMethod;
  @ApiProperty({ enum: PAYMENT_STATUSES }) paymentStatus!: PaymentStatus;
  @ApiProperty({ enum: ORDER_STATUSES }) status!: OrderStatus;
  @ApiProperty({ type: String, nullable: true }) riderId!: string | null;
  @ApiProperty({ type: String, nullable: true }) riderName!: string | null;
  @ApiProperty({ type: Number, nullable: true }) codCollectedAmount!: number | null;
}

export class OrderStatusChangeDto {
  @ApiProperty({ enum: ORDER_STATUSES })
  @IsIn(ORDER_STATUSES, { message: 'Choose a status.' })
  to!: OrderStatus;

  @ApiPropertyOptional({ maxLength: 500, description: 'Shown in the status timeline.' })
  @IsOptionalText(500)
  note?: string;

  @ApiPropertyOptional({ maxLength: 500, description: 'Required when cancelling.' })
  @IsOptionalText(500)
  reason?: string;
}

export class AssignRiderDto {
  @ApiProperty()
  @IsObjectId()
  riderId!: string;
}

export class CodCollectedDto {
  @ApiProperty({ example: 5480 })
  @IsMoney()
  amount!: number;

  @ApiPropertyOptional({ maxLength: 500, description: 'Required when the amount differs from the order total.' })
  @IsOptionalText(500)
  note?: string;
}

export class FileLinkDto implements FileLinkDTO {
  @ApiProperty({ description: 'Works for 10 minutes.' }) url!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}

export class RejectReceiptDto {
  @ApiProperty({ example: 'The amount on the receipt does not match the order total.' })
  @IsRequiredText(3, 500, 'Reason')
  reason!: string;
}

export class InternalNoteDto {
  @ApiProperty({ maxLength: INTERNAL_NOTE_MAX, description: 'Staff only; an empty string clears it.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(INTERNAL_NOTE_MAX, { message: `Use at most ${INTERNAL_NOTE_MAX.toLocaleString('en-US')} characters.` })
  internalNote!: string;
}

export class StatusCountsDto implements Record<OrderStatus | 'all', number> {
  @ApiProperty() NEW!: number;
  @ApiProperty() CONFIRMED!: number;
  @ApiProperty() DISPATCHED!: number;
  @ApiProperty() DELIVERED!: number;
  @ApiProperty() CANCELLED!: number;
  @ApiProperty() RETURNED!: number;
  @ApiProperty() all!: number;
}

export class AdminReceiptDto extends ReceiptDto implements AdminReceiptDTO {
  @ApiProperty({ type: String, nullable: true }) reviewedByName!: string | null;
}

export class AdminStatusHistoryEntryDto implements AdminStatusHistoryEntryDTO {
  @ApiProperty({ enum: ORDER_STATUSES }) status!: OrderStatus;
  @ApiProperty({ format: 'date-time' }) at!: string;
  @ApiProperty({ enum: ACTOR_TYPES }) byType!: ActorType;
  @ApiProperty({ type: String, nullable: true }) byUserName!: string | null;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
}

export class OrderCustomerDto {
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty() phone!: string;
}

export class OrderRiderSnapshotDto {
  @ApiProperty() name!: string;
  @ApiProperty() phone!: string;
}

export class CodCollectedResponseDto {
  @ApiProperty() amount!: number;
  @ApiProperty({ format: 'date-time' }) at!: string;
  @ApiProperty({ type: String, nullable: true }) byName!: string | null;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
}

export class AdminOrderDto implements AdminOrderDTO {
  @ApiProperty() id!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty({ type: String, nullable: true }) trackingCode!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ type: OrderCustomerDto }) customer!: OrderCustomerDto;
  @ApiProperty({ type: ShippingAddressDto }) shippingAddress!: ShippingAddressDto;
  @ApiProperty() deliveryAreaId!: string;
  @ApiProperty({ type: [OrderItemDto] }) items!: OrderItemDto[];
  @ApiProperty() subtotal!: number;
  @ApiProperty() deliveryFee!: number;
  @ApiProperty() discount!: number;
  @ApiProperty({ type: String, nullable: true }) discountReason!: string | null;
  @ApiProperty() total!: number;
  @ApiProperty({ enum: PAYMENT_METHODS }) paymentMethod!: PaymentMethod;
  @ApiProperty({ enum: PAYMENT_STATUSES }) paymentStatus!: PaymentStatus;
  @ApiProperty({ type: [AdminReceiptDto] }) receipts!: AdminReceiptDto[];
  @ApiProperty({ enum: ORDER_STATUSES }) status!: OrderStatus;
  @ApiProperty({ type: [AdminStatusHistoryEntryDto] }) statusHistory!: AdminStatusHistoryEntryDto[];
  @ApiProperty({ type: String, nullable: true }) riderId!: string | null;
  @ApiProperty({ type: OrderRiderSnapshotDto, nullable: true }) rider!: OrderRiderSnapshotDto | null;
  @ApiProperty({ type: CodCollectedResponseDto, nullable: true }) codCollected!: CodCollectedResponseDto | null;
  @ApiProperty({ type: String, nullable: true }) customerNote!: string | null;
  @ApiProperty({ type: String, nullable: true }) internalNote!: string | null;
  @ApiProperty({ type: String, nullable: true }) cancelReason!: string | null;
}

/** `GET /api/admin/orders/product-options` */
export class ProductOptionsQueryDto {
  @ApiPropertyOptional({ example: 'ppc', description: 'Part of a product name or SKU (at least 2 characters).' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class AdminOrderProductOptionDto implements AdminOrderProductOptionDTO {
  @ApiProperty() productId!: string;
  @ApiProperty() variantId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty() variantLabel!: string;
  @ApiProperty() sku!: string;
  @ApiProperty({ description: 'Single-unit price; the order is re-priced with bulk tiers.' }) price!: number;
  @ApiProperty() stock!: number;
}

/** `POST /api/admin/orders/quote`; mirrors `adminOrderQuoteSchema`. */
export class AdminOrderQuoteDto {
  @ApiProperty({ description: 'An active customer.' })
  @IsObjectId()
  userId!: string;

  @ApiProperty({ description: "One of the customer's saved addresses; its area sets the delivery fee." })
  @IsObjectId()
  addressId!: string;

  @ApiProperty({ type: [CartItemDto], minItems: 1, maxItems: CART_MAX_LINES })
  @IsArray({ message: 'Send the order lines as a list.' })
  @ArrayMinSize(1, { message: 'Add at least one product.' })
  @ArrayMaxSize(CART_MAX_LINES, { message: `An order can have at most ${CART_MAX_LINES} lines.` })
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];

  @ApiPropertyOptional({ example: 300, description: 'Rupees off the subtotal. Needs the orders.discount permission.' })
  @IsOptional()
  @IsMoney()
  discountAmount?: number;
}

/** The priced order with the staff discount taken off: `total = subtotal - discount + delivery`. */
export class AdminOrderQuoteResultDto extends PricedCartDto {
  @ApiProperty({ description: 'The discount applied (0 when none).' }) discount!: number;
}

/** `POST /api/admin/orders` (with `Idempotency-Key`); mirrors `adminCreateOrderSchema`. */
export class AdminCreateOrderDto extends AdminOrderQuoteDto {
  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS, { message: 'Choose cash on delivery or bank transfer.' })
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ maxLength: CUSTOMER_NOTE_MAX })
  @IsOptionalText(CUSTOMER_NOTE_MAX)
  customerNote?: string;

  @ApiPropertyOptional({ maxLength: 300, description: 'Required when discountAmount is more than 0.' })
  @IsOptionalText(300)
  discountReason?: string;

  @ApiProperty({ example: 20_145, description: 'The total shown in the form; a different server total gives 409 PRICE_CHANGED.' })
  @IsInt({ message: 'Use whole rupees.' })
  @Min(0, { message: "Amount can't be negative." })
  @Max(1_000_000_000, { message: 'Amount is too large.' })
  expectedTotal!: number;
}
