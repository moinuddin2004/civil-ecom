import type { AddressDTO } from '@aricon/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import {
  IsClearableText,
  IsObjectId,
  IsOptionalText,
  IsPersonName,
  IsPkPhone,
  IsRequiredText,
} from '../../../common/validation/validators.js';

/* Account requests and responses (SPEC §7.2 "Account"); mirror `profileSchema` / `addressSchema`. */

/** `PATCH /api/account/profile`. Email is not editable here. */
export class UpdateProfileDto {
  @ApiProperty({ example: 'Ahmed Raza' })
  @IsPersonName()
  name!: string;

  @ApiProperty({ example: '0300 1234567', description: 'Any common format; stored as +923XXXXXXXXX.' })
  @IsPkPhone()
  phone!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Omit to keep; null or "" to clear.' })
  @IsClearableText(120)
  companyName?: string | null;
}

/** `POST /api/account/addresses` and `PATCH /api/account/addresses/:id` (the whole address). */
export class AddressDto {
  @ApiProperty({ example: 'Site – Gulshan' })
  @IsRequiredText(1, 60, 'Label')
  label!: string;

  @ApiProperty({ example: 'Ahmed Raza' })
  @IsPersonName()
  contactName!: string;

  @ApiProperty({ example: '0300 1234567' })
  @IsPkPhone()
  phone!: string;

  @ApiProperty({ example: 'Plot 12, Block 5' })
  @IsRequiredText(3, 200)
  line1!: string;

  @ApiPropertyOptional()
  @IsOptionalText(200)
  line2?: string;

  @ApiPropertyOptional({ example: 'Near Maskan Chowrangi' })
  @IsOptionalText(200)
  landmark?: string;

  @ApiProperty({ description: 'Delivery area id.' })
  @IsObjectId()
  areaId!: string;

  @ApiPropertyOptional({ example: 'Karachi', default: 'Karachi' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(2, 60, { message: 'Use 2–60 characters.' })
  city?: string;

  @ApiPropertyOptional({ description: 'true makes this the default address.' })
  @IsOptional()
  @IsBoolean({ message: 'Use true or false.' })
  isDefault?: boolean;
}

export class AddressResponseDto implements AddressDTO {
  @ApiProperty() id!: string;
  @ApiProperty() label!: string;
  @ApiProperty() contactName!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() line1!: string;
  @ApiProperty({ type: String, nullable: true }) line2!: string | null;
  @ApiProperty({ type: String, nullable: true }) landmark!: string | null;
  @ApiProperty() areaId!: string;
  @ApiProperty({ type: String, nullable: true, description: 'null if the area was removed.' }) areaName!: string | null;
  @ApiProperty({ description: 'false when the area no longer delivers; checkout blocks it.' }) areaServiceable!: boolean;
  @ApiProperty() city!: string;
  @ApiProperty() isDefault!: boolean;
}
