import { USER_STATUSES, type AdminCustomerDetailDTO, type AdminCustomerListItemDTO, type UserStatus } from '@aricon/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/http/pagination.dto.js';
import { IsClearableText, IsOptionalText } from '../../../common/validation/validators.js';
import { AdminOrderListItemDto } from '../../orders/admin/dto/admin-orders.dto.js';

export class CustomerListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Name, email or phone (any format).' })
  @IsOptionalText(100)
  q?: string;

  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsIn(USER_STATUSES, { message: 'Use active or blocked.' })
  status?: UserStatus;
}

/** Optional note kept in the audit log with a block/unblock. */
export class CustomerStatusNoteDto {
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsClearableText(500)
  note?: string | null;
}

export class AdminCustomerListItemDto implements AdminCustomerListItemDTO {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty() phone!: string;
  @ApiProperty({ type: String, nullable: true }) companyName!: string | null;
  @ApiProperty() orderCount!: number;
  @ApiProperty({ description: 'Leaves out cancelled and returned orders.' }) totalSpent!: number;
  @ApiProperty({ enum: USER_STATUSES }) status!: UserStatus;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class AdminCustomerAddressDto {
  @ApiProperty() id!: string;
  @ApiProperty() label!: string;
  @ApiProperty() contactName!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() line1!: string;
  @ApiProperty({ type: String, nullable: true }) line2!: string | null;
  @ApiProperty({ type: String, nullable: true }) landmark!: string | null;
  @ApiProperty({ type: String, nullable: true }) areaName!: string | null;
  @ApiProperty() city!: string;
  @ApiProperty() isDefault!: boolean;
}

export class AdminCustomerDetailDto extends AdminCustomerListItemDto implements AdminCustomerDetailDTO {
  @ApiProperty({ type: [AdminCustomerAddressDto] }) addresses!: AdminCustomerAddressDto[];
  @ApiProperty({ type: [AdminOrderListItemDto] }) recentOrders!: AdminOrderListItemDto[];
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) lastLoginAt!: string | null;
}
