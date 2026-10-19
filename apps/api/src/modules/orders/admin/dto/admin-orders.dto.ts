import {
  ACTOR_TYPES,
  INTERNAL_NOTE_MAX,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type ActorType,
  type AdminOrderDTO,
  type AdminOrderListItemDTO,
  type AdminReceiptDTO,
  type AdminStatusHistoryEntryDTO,
  type FileLinkDTO,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from '@aricon/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/http/pagination.dto.js';
import {
  IsMoney,
  IsObjectId,
  IsOptionalCsvList,
  IsOptionalDateKey,
  IsOptionalText,
  IsRequiredText,
} from '../../../../common/validation/validators.js';
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
  @ApiProperty({ type: String, nullable: true }) riderName!: string | null;
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
}

export class AdminOrderDto implements AdminOrderDTO {
  @ApiProperty() id!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ type: OrderCustomerDto }) customer!: OrderCustomerDto;
  @ApiProperty({ type: ShippingAddressDto }) shippingAddress!: ShippingAddressDto;
  @ApiProperty() deliveryAreaId!: string;
  @ApiProperty({ type: [OrderItemDto] }) items!: OrderItemDto[];
  @ApiProperty() subtotal!: number;
  @ApiProperty() deliveryFee!: number;
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
