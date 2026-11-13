import {
  ACTOR_TYPES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  RECEIPT_STATUSES,
  UNITS,
  type ActorType,
  type CustomerOrderDTO,
  type CustomerOrderListItemDTO,
  type OrderItemDTO,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
  type ReceiptDTO,
  type ReceiptStatus,
  type ReorderResultDTO,
  type ShippingAddressDTO,
  type StatusHistoryEntryDTO,
  type Unit,
} from '@aricon/shared';
import { ApiProperty } from '@nestjs/swagger';
import { PricedCartDto } from '../../cart/dto/cart.response.dto.js';

/* Swagger models for customer orders; each implements the shared DTO the web app reads. */

const nullableString = { type: String, nullable: true } as const;

export class OrderItemDto implements OrderItemDTO {
  @ApiProperty() productId!: string;
  @ApiProperty() variantId!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() productName!: string;
  @ApiProperty({ ...nullableString, description: 'Current slug while the product is on sale.' }) productSlug!: string | null;
  @ApiProperty() variantLabel!: string;
  @ApiProperty() brandName!: string;
  @ApiProperty({ enum: UNITS }) unit!: Unit;
  @ApiProperty(nullableString) imageKey!: string | null;
  @ApiProperty() qty!: number;
  @ApiProperty() mrp!: number;
  @ApiProperty() basePrice!: number;
  @ApiProperty() unitPrice!: number;
  @ApiProperty({ type: Number, nullable: true }) appliedTierMinQty!: number | null;
  @ApiProperty() lineTotal!: number;
}

export class ShippingAddressDto implements ShippingAddressDTO {
  @ApiProperty() label!: string;
  @ApiProperty() contactName!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() line1!: string;
  @ApiProperty(nullableString) line2!: string | null;
  @ApiProperty(nullableString) landmark!: string | null;
  @ApiProperty() areaId!: string;
  @ApiProperty() areaName!: string;
  @ApiProperty() city!: string;
}

export class ReceiptDto implements ReceiptDTO {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'image/jpeg' }) mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty({ format: 'date-time' }) uploadedAt!: string;
  @ApiProperty({ enum: RECEIPT_STATUSES }) status!: ReceiptStatus;
  @ApiProperty(nullableString) rejectReason!: string | null;
  @ApiProperty({ ...nullableString, format: 'date-time' }) reviewedAt!: string | null;
}

export class StatusHistoryEntryDto implements StatusHistoryEntryDTO {
  @ApiProperty({ enum: ORDER_STATUSES }) status!: OrderStatus;
  @ApiProperty({ format: 'date-time' }) at!: string;
  @ApiProperty({ enum: ACTOR_TYPES }) byType!: ActorType;
  @ApiProperty(nullableString) note!: string | null;
}

export class OrderRiderDto {
  @ApiProperty() name!: string;
  @ApiProperty() phone!: string;
}

export class CustomerOrderDto implements CustomerOrderDTO {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'ARC-2026-000123' }) orderNumber!: string;
  @ApiProperty({ type: String, nullable: true, example: '482915', description: '6-digit code to track the order without signing in.' }) trackingCode!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ enum: ORDER_STATUSES }) status!: OrderStatus;
  @ApiProperty({ enum: PAYMENT_METHODS }) paymentMethod!: PaymentMethod;
  @ApiProperty({ enum: PAYMENT_STATUSES }) paymentStatus!: PaymentStatus;
  @ApiProperty({ type: [OrderItemDto] }) items!: OrderItemDto[];
  @ApiProperty() subtotal!: number;
  @ApiProperty() deliveryFee!: number;
  @ApiProperty() discount!: number;
  @ApiProperty() total!: number;
  @ApiProperty({ type: ShippingAddressDto }) shippingAddress!: ShippingAddressDto;
  @ApiProperty({ type: [ReceiptDto] }) receipts!: ReceiptDto[];
  @ApiProperty({ type: [StatusHistoryEntryDto] }) statusHistory!: StatusHistoryEntryDto[];
  @ApiProperty({ type: OrderRiderDto, nullable: true, description: 'Once the order is dispatched.' }) rider!: OrderRiderDto | null;
  @ApiProperty(nullableString) customerNote!: string | null;
  @ApiProperty(nullableString) cancelReason!: string | null;
  @ApiProperty() canCancel!: boolean;
  @ApiProperty() canUploadReceipt!: boolean;
}

export class CustomerOrderListItemDto implements CustomerOrderListItemDTO {
  @ApiProperty() id!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty({ type: String, nullable: true, example: '482915' }) trackingCode!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ description: 'Units across all lines.' }) itemCount!: number;
  @ApiProperty() total!: number;
  @ApiProperty({ enum: PAYMENT_METHODS }) paymentMethod!: PaymentMethod;
  @ApiProperty({ enum: PAYMENT_STATUSES }) paymentStatus!: PaymentStatus;
  @ApiProperty({ enum: ORDER_STATUSES }) status!: OrderStatus;
}

export class ReorderSkippedDto {
  @ApiProperty() productName!: string;
  @ApiProperty() variantLabel!: string;
  @ApiProperty({ example: 'Out of stock.' }) reason!: string;
}

export class ReorderResultDto implements ReorderResultDTO {
  @ApiProperty({ type: PricedCartDto }) cart!: PricedCartDto;
  @ApiProperty({ type: [ReorderSkippedDto] }) skipped!: ReorderSkippedDto[];
}
