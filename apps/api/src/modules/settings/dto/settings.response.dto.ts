import type { BankAccountDTO, PageDTO, PublicSettingsDTO } from '@aricon/shared';
import { ApiProperty } from '@nestjs/swagger';

const nullableString = { type: String, nullable: true } as const;

export class BankAccountDto implements BankAccountDTO {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Meezan Bank' }) bankName!: string;
  @ApiProperty({ example: 'Aricon (Pvt) Ltd' }) accountTitle!: string;
  @ApiProperty() accountNumber!: string;
  @ApiProperty(nullableString) iban!: string | null;
  @ApiProperty(nullableString) raastId!: string | null;
}

export class PaymentMethodsDto {
  @ApiProperty() cod!: boolean;
  @ApiProperty() bankTransfer!: boolean;
}

export class PublicSettingsDto implements PublicSettingsDTO {
  @ApiProperty({ example: 'Aricon Shop' }) storeName!: string;
  @ApiProperty({ description: "'' when not set." }) phone!: string;
  @ApiProperty({ description: "`+923XXXXXXXXX`, or '' when not set." }) whatsapp!: string;
  @ApiProperty() email!: string;
  @ApiProperty() address!: string;
  @ApiProperty({ type: PaymentMethodsDto }) paymentMethods!: PaymentMethodsDto;
  @ApiProperty({ type: Number, nullable: true, description: 'COD is not offered above this total; null = no limit.' })
  codMaxOrderAmount!: number | null;
  @ApiProperty({ example: 500 }) defaultDeliveryFee!: number;
  @ApiProperty({ type: [BankAccountDto] }) bankAccounts!: BankAccountDto[];
  @ApiProperty({ description: 'Markdown.' }) bankTransferInstructions!: string;
}

export class PageDto implements PageDTO {
  @ApiProperty({ example: 'refund-policy' }) key!: string;
  @ApiProperty({ example: 'Refund policy' }) title!: string;
  @ApiProperty({ description: 'Markdown; empty until an admin writes it.' }) body!: string;
}
