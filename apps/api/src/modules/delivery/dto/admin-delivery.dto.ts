import type { AdminDeliveryAreaDTO, RiderDTO } from '@aricon/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { IsMoney, IsPersonName, IsPkPhone, IsRequiredText, IsSortOrder } from '../../../common/validation/validators.js';

/* Admin delivery areas and riders (SPEC §7.3 "Delivery"); mirror the shared catalog schemas. */

const trim = Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

export class CreateDeliveryAreaDto {
  @ApiProperty({ example: 'Gulshan-e-Iqbal' })
  @IsRequiredText(2, 80, 'Name')
  name!: string;

  @ApiPropertyOptional({ example: 'Karachi', default: 'Karachi' })
  @trim
  @IsOptional()
  @IsString()
  @Length(2, 60, { message: 'Use 2–60 characters.' })
  city?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: 'Use true or false.' })
  isServiceable?: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'null → the default delivery fee from settings.' })
  @IsOptional()
  @IsMoney()
  deliveryFee?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'null → no free delivery.' })
  @IsOptional()
  @IsMoney()
  freeDeliveryAbove?: number | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsSortOrder()
  sortOrder?: number;
}

/** Every field optional; `null` fees clear them. */
export class UpdateDeliveryAreaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsRequiredText(2, 80, 'Name')
  name?: string;

  @ApiPropertyOptional()
  @trim
  @IsOptional()
  @IsString()
  @Length(2, 60, { message: 'Use 2–60 characters.' })
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'Use true or false.' })
  isServiceable?: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsMoney()
  deliveryFee?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsMoney()
  freeDeliveryAbove?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsSortOrder()
  sortOrder?: number;
}

export class AdminDeliveryAreaDto implements AdminDeliveryAreaDTO {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() city!: string;
  @ApiProperty() isServiceable!: boolean;
  @ApiProperty({ type: Number, nullable: true, description: 'null = uses the default fee.' }) deliveryFee!: number | null;
  @ApiProperty({ type: Number, nullable: true }) freeDeliveryAbove!: number | null;
  @ApiProperty() sortOrder!: number;
}

export class CreateRiderDto {
  @ApiProperty({ example: 'Imran Ali' })
  @IsPersonName()
  name!: string;

  @ApiProperty({ example: '0312 3456789' })
  @IsPkPhone()
  phone!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: 'Use true or false.' })
  isActive?: boolean;
}

export class UpdateRiderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsPersonName()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPkPhone()
  phone?: string;

  @ApiPropertyOptional({ description: 'false instead of deleting (orders keep a snapshot).' })
  @IsOptional()
  @IsBoolean({ message: 'Use true or false.' })
  isActive?: boolean;
}

export class RiderDto implements RiderDTO {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() isActive!: boolean;
}
