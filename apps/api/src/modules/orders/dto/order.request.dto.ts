import { CUSTOMER_NOTE_MAX, PAYMENT_METHODS, type PaymentMethod } from '@aricon/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { IsObjectId, IsOptionalText, IsRequiredText } from '../../../common/validation/validators.js';
import type { PlaceOrderInput } from '../order-placement.service.js';

/* Customer order requests (SPEC §6.6–6.7); mirror `placeOrderSchema` / `cancelOrderSchema`. */

/** `POST /api/orders` (with the `Idempotency-Key` header). */
export class PlaceOrderDto implements PlaceOrderInput {
  @ApiProperty({ description: 'One of your saved addresses; its area sets the delivery fee.' })
  @IsObjectId()
  addressId!: string;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS, { message: 'Choose cash on delivery or bank transfer.' })
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ maxLength: CUSTOMER_NOTE_MAX, example: 'Call before coming; site gate on the left.' })
  @IsOptionalText(CUSTOMER_NOTE_MAX)
  customerNote?: string;

  @ApiProperty({ example: 20_145, description: 'The total shown at checkout; a different server total → 409 PRICE_CHANGED.' })
  @IsInt({ message: 'Use whole rupees.' })
  @Min(0, { message: "Amount can't be negative." })
  @Max(1_000_000_000, { message: 'Amount is too large.' })
  expectedTotal!: number;
}

/** `POST /api/orders/:orderNumber/cancel`. */
export class CancelOrderDto {
  @ApiProperty({ example: 'Ordered the wrong size.', minLength: 3, maxLength: 500 })
  @IsRequiredText(3, 500, 'Reason')
  reason!: string;
}
