import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import {
  IsNormalizedEmail,
  IsOptionalText,
  IsPersonName,
  IsRequiredText,
} from '../../common/validation/validators.js';

/** `POST /api/public/rfp` (SPEC §7.2 "Company website inquiries"); mirrors `rfpSchema` in shared. */
export class RfpDto {
  @ApiProperty({ example: 'Raza Builders' })
  @IsRequiredText(2, 120, 'Company')
  company!: string;

  @ApiProperty({ example: 'Ahmed Raza' })
  @IsPersonName()
  contactPerson!: string;

  @ApiProperty({ example: 'ahmed@razabuilders.pk' })
  @IsNormalizedEmail()
  email!: string;

  @ApiPropertyOptional({ example: '0300 1234567' })
  @IsOptionalText(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'DHA Phase 8' })
  @IsOptionalText(120)
  location?: string;

  @ApiProperty({ example: 'Structural design' })
  @IsRequiredText(2, 120, 'Service')
  service!: string;

  @ApiProperty({ example: 'Four-storey commercial building, need a quote for design and supervision.' })
  @IsRequiredText(10, 5_000, 'Brief')
  brief!: string;

  /** Honeypot: hidden on the form, so only bots fill it. */
  @ApiPropertyOptional({ description: 'Leave empty (spam trap).' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;
}
