import type { AdminSettingsDTO, PageKey } from '@aricon/shared';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  IsMoney,
  IsNormalizedEmail,
  IsObjectId,
  IsOptionalText,
  IsPkPhone,
  IsRequiredText,
} from '../../../common/validation/validators.js';

/* `PUT /api/admin/settings` (SPEC §5.14, ADMIN only): the whole settings document; mirrors `settingsSchema`. */

const PK_IBAN = /^PK\d{2}[A-Z]{4}[A-Z0-9]{16}$/;

export class PaymentMethodsInput {
  @ApiProperty() @IsBoolean({ message: 'Use true or false.' }) cod!: boolean;
  @ApiProperty() @IsBoolean({ message: 'Use true or false.' }) bankTransfer!: boolean;
}

export class BankAccountInput {
  @ApiPropertyOptional({ description: 'Keep an existing account’s id when editing it.' })
  @IsOptional()
  @IsObjectId()
  id?: string;

  @ApiProperty({ example: 'Meezan Bank' })
  @IsRequiredText(2, 80, 'Bank name')
  bankName!: string;

  @ApiProperty({ example: 'Aricon (Pvt) Ltd' })
  @IsRequiredText(2, 120, 'Account title')
  accountTitle!: string;

  @ApiProperty({ example: '0101-0104567890' })
  @IsRequiredText(4, 40, 'Account number')
  accountNumber!: string;

  @ApiPropertyOptional({ example: 'PK36MEZN0001010104567890' })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const iban = value.trim().toUpperCase().replace(/\s+/g, '');
    return iban ? iban : undefined;
  })
  @IsOptional()
  @IsString()
  @Matches(PK_IBAN, { message: 'Enter a Pakistani IBAN, like PK36MEZN0001010104567890.' })
  iban?: string;

  @ApiPropertyOptional()
  @IsOptionalText(40)
  raastId?: string;
}

const pageText = () =>
  applyDecorators(ApiProperty({ description: 'Markdown.' }), IsString(), MaxLength(50_000, { message: 'This page is too long.' }));

export class PagesInput implements Record<PageKey, string> {
  @pageText() about!: string;
  @pageText() faq!: string;
  @pageText() contact!: string;
  @pageText() refundPolicy!: string;
  @pageText() deliveryPolicy!: string;
  @pageText() privacyPolicy!: string;
  @pageText() terms!: string;
}

export class UpdateSettingsDto {
  @ApiProperty({ example: 'Aricon Shop' })
  @IsRequiredText(2, 80, 'Store name')
  storeName!: string;

  @ApiProperty({ example: '021 3456 7890', description: 'Landline or mobile, shown as written.' })
  @IsRequiredText(5, 30, 'Phone')
  phone!: string;

  @ApiProperty({ example: '0300 1234567' })
  @IsPkPhone()
  whatsapp!: string;

  @ApiProperty({ example: 'shop@aricon.com.pk' })
  @IsNormalizedEmail()
  email!: string;

  @ApiProperty()
  @IsRequiredText(5, 300, 'Address')
  address!: string;

  @ApiProperty({ type: [String], maxItems: 10, description: 'New order and receipt alerts.' })
  @IsArray()
  @ArrayMaxSize(10, { message: 'Add at most 10 addresses.' })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : item)) : value,
  )
  @IsString({ each: true })
  @MaxLength(254, { each: true })
  @IsEmail({}, { each: true, message: 'Enter valid email addresses, like name@example.com.' })
  orderNotificationEmails!: string[];

  @ApiProperty({ example: 'projects@aricon.com.pk', description: 'Company-website inquiries go here.' })
  @IsNormalizedEmail()
  rfpEmail!: string;

  @ApiProperty({ type: PaymentMethodsInput })
  @ValidateNested()
  @Type(() => PaymentMethodsInput)
  paymentMethods!: PaymentMethodsInput;

  @ApiProperty({ type: Number, nullable: true, description: 'COD only up to this total; null = no limit.' })
  @IsOptional()
  @IsMoney()
  codMaxOrderAmount!: number | null;

  @ApiProperty({ example: 500 })
  @IsMoney()
  defaultDeliveryFee!: number;

  @ApiProperty({ type: [BankAccountInput], maxItems: 10 })
  @IsArray()
  @ArrayMaxSize(10, { message: 'Add at most 10 bank accounts.' })
  @ValidateNested({ each: true })
  @Type(() => BankAccountInput)
  bankAccounts!: BankAccountInput[];

  @ApiProperty({ description: 'Markdown.' })
  @IsString()
  @MaxLength(5_000, { message: 'Use at most 5,000 characters.' })
  bankTransferInstructions!: string;

  @ApiProperty({ example: 5 })
  @IsInt({ message: 'Use a whole number.' })
  @Min(0)
  @Max(1_000_000)
  lowStockDefault!: number;

  @ApiProperty({ type: PagesInput })
  @ValidateNested()
  @Type(() => PagesInput)
  pages!: PagesInput;
}

export class AdminBankAccountDto {
  @ApiProperty() id!: string;
  @ApiProperty() bankName!: string;
  @ApiProperty() accountTitle!: string;
  @ApiProperty() accountNumber!: string;
  @ApiProperty({ type: String, nullable: true }) iban!: string | null;
  @ApiProperty({ type: String, nullable: true }) raastId!: string | null;
}

export class AdminPagesDto implements Record<PageKey, string> {
  @ApiProperty() about!: string;
  @ApiProperty() faq!: string;
  @ApiProperty() contact!: string;
  @ApiProperty() refundPolicy!: string;
  @ApiProperty() deliveryPolicy!: string;
  @ApiProperty() privacyPolicy!: string;
  @ApiProperty() terms!: string;
}

export class AdminSettingsDto implements AdminSettingsDTO {
  @ApiProperty() storeName!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() whatsapp!: string;
  @ApiProperty() email!: string;
  @ApiProperty() address!: string;
  @ApiProperty({ type: [String] }) orderNotificationEmails!: string[];
  @ApiProperty() rfpEmail!: string;
  @ApiProperty({ type: PaymentMethodsInput }) paymentMethods!: PaymentMethodsInput;
  @ApiProperty({ type: Number, nullable: true }) codMaxOrderAmount!: number | null;
  @ApiProperty() defaultDeliveryFee!: number;
  @ApiProperty({ type: [AdminBankAccountDto] }) bankAccounts!: AdminBankAccountDto[];
  @ApiProperty() bankTransferInstructions!: string;
  @ApiProperty() lowStockDefault!: number;
  @ApiProperty({ type: AdminPagesDto }) pages!: AdminPagesDto;
  @ApiProperty({ type: String, nullable: true, format: 'date-time', description: 'null until first saved.' })
  updatedAt!: string | null;
}

