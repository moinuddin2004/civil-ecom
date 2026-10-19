import {
  PERMISSION_KEYS,
  STAFF_ROLES,
  USER_STATUSES,
  type Permission,
  type PermissionCatalogDTO,
  type StaffDTO,
  type StaffRole,
  type TemporaryPasswordDTO,
  type UserStatus,
} from '@aricon/shared';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsOptional } from 'class-validator';
import { IsNormalizedEmail, IsPersonName, IsPkPhone } from '../../../common/validation/validators.js';
import { AdminUserResponseDto } from '../../auth/dto/auth.response.dto.js';

/* Staff management (SPEC §4, §7.3, ADMIN only); mirrors `staffCreateSchema` / `staffUpdateSchema`. */

function PermissionList() {
  return applyDecorators(
    ApiPropertyOptional({ enum: PERMISSION_KEYS, isArray: true, description: 'Dependencies are added automatically.' }),
    IsOptional(),
    IsArray(),
    ArrayMaxSize(50),
    IsIn(PERMISSION_KEYS, { each: true, message: 'Use only permissions from the permission list.' }),
  );
}

export class CreateStaffDto {
  @ApiProperty({ example: 'Sana Malik' })
  @IsPersonName()
  name!: string;

  @ApiProperty({ example: 'sana@aricon.com.pk', description: 'Their own email; a customer account can’t become staff.' })
  @IsNormalizedEmail()
  email!: string;

  @ApiPropertyOptional({ example: '0321 7654321' })
  @IsOptional()
  @IsPkPhone()
  phone?: string;

  @ApiProperty({ enum: STAFF_ROLES })
  @IsIn(STAFF_ROLES, { message: 'Choose Admin or Staff.' })
  role!: StaffRole;

  @PermissionList()
  permissions?: Permission[];
}

export class UpdateStaffDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsPersonName()
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'null removes it.' })
  @IsOptional()
  @IsPkPhone()
  phone?: string | null;

  @ApiPropertyOptional({ enum: STAFF_ROLES })
  @IsOptional()
  @IsIn(STAFF_ROLES, { message: 'Choose Admin or Staff.' })
  role?: StaffRole;

  @PermissionList()
  permissions?: Permission[];

  @ApiPropertyOptional({ enum: USER_STATUSES, description: 'blocked signs them out everywhere.' })
  @IsOptional()
  @IsIn(USER_STATUSES, { message: 'Use active or blocked.' })
  status?: UserStatus;
}

export class StaffResponseDto extends AdminUserResponseDto implements StaffDTO {
  @ApiProperty({ enum: PERMISSION_KEYS, isArray: true, description: 'The stored list (ADMIN has every permission anyway).' })
  permissions!: Permission[];

  @ApiProperty() mustChangePassword!: boolean;

  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class TemporaryPasswordResponseDto implements TemporaryPasswordDTO {
  @ApiProperty({ type: StaffResponseDto }) staff!: StaffResponseDto;

  @ApiProperty({ example: 'k7Rm2PqW9xTa', description: 'Shown once; never stored, logged or emailed.' })
  temporaryPassword!: string;
}

export class PermissionEntryDto {
  @ApiProperty({ enum: PERMISSION_KEYS }) key!: Permission;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: PERMISSION_KEYS, isArray: true }) dependsOn!: Permission[];
  @ApiProperty({ description: 'Shown with a warning in the editor.' }) sensitive!: boolean;
}

export class PermissionGroupDto {
  @ApiProperty() group!: string;
  @ApiProperty({ type: [PermissionEntryDto] }) permissions!: PermissionEntryDto[];
}

export class PermissionPresetDto {
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: PERMISSION_KEYS, isArray: true }) permissions!: Permission[];
}

export class PermissionCatalogResponseDto implements PermissionCatalogDTO {
  @ApiProperty({ type: [PermissionGroupDto] }) groups!: PermissionGroupDto[];
  @ApiProperty({ type: [PermissionPresetDto] }) presets!: PermissionPresetDto[];
  @ApiProperty({ enum: PERMISSION_KEYS, isArray: true }) defaultStaffPermissions!: Permission[];
}
