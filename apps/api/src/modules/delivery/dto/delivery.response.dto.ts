import type { DeliveryAreaDTO } from '@aricon/shared';
import { ApiProperty } from '@nestjs/swagger';

export class DeliveryAreaDto implements DeliveryAreaDTO {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Gulshan-e-Iqbal' }) name!: string;
  @ApiProperty({ example: 'Karachi' }) city!: string;
  @ApiProperty({ description: 'false = "Not delivering yet"; checkout is blocked.' }) isServiceable!: boolean;
  @ApiProperty({ example: 500, description: 'Effective fee: the area fee, or the store default.' }) deliveryFee!: number;
  @ApiProperty({ type: Number, nullable: true, description: 'Free delivery from this subtotal; null = never.' })
  freeDeliveryAbove!: number | null;
}
