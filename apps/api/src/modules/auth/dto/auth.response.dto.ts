import {
  effectivePermissions,
  PERMISSION_KEYS,
  STAFF_ROLES,
  USER_STATUSES,
  type AdminMeDTO,
  type AdminUserDTO,
  type CustomerDTO,
  type Permission,
  type StaffRole,
  type UserStatus,
} from '@aricon/shared';
import { ApiProperty } from '@nestjs/swagger';
import type { UserLean } from '../../../models/user.model.js';

/*
 * Response shapes. Each class implements the DTO interface from `@aricon/shared`, so the compiler
 * keeps the API and the web app on the same contract (CLAUDE.md §45); the classes exist for Swagger.
 */

export class CustomerResponseDto implements CustomerDTO {
  @ApiProperty({ example: '665f1c2a9b1e8a0012a3b4c5' })
  id!: string;

  @ApiProperty({ example: 'Ahmed Raza' })
  name!: string;

  @ApiProperty({ example: 'ahmed@example.com' })
  email!: string;

  @ApiProperty({ example: '+923001234567' })
  phone!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Raza Builders' })
  companyName!: string | null;

  @ApiProperty({ enum: ['CUSTOMER'] })
  role!: 'CUSTOMER';
}

export class AdminUserResponseDto implements AdminUserDTO {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Sana Malik' })
  name!: string;

  @ApiProperty({ example: 'sana@aricon.com.pk' })
  email!: string;

  @ApiProperty({ type: String, nullable: true })
  phone!: string | null;

  @ApiProperty({ enum: STAFF_ROLES })
  role!: StaffRole;

  @ApiProperty({ enum: USER_STATUSES })
  status!: UserStatus;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  lastLoginAt!: string | null;
}

export class AdminMeResponseDto implements AdminMeDTO {
  @ApiProperty({ type: AdminUserResponseDto })
  user!: AdminUserResponseDto;

  @ApiProperty({ enum: PERMISSION_KEYS, isArray: true, description: 'Effective permissions (all of them for ADMIN).' })
  permissions!: Permission[];

  @ApiProperty({ description: 'Until this is false, only /api/admin/auth/* works.' })
  mustChangePassword!: boolean;
}

/* Mappers (entity → response). */

export function toCustomerDto(user: UserLean): CustomerDTO {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
    companyName: user.companyName ?? null,
    role: 'CUSTOMER',
  };
}

export function toAdminMeDto(user: UserLean): AdminMeDTO {
  if (user.role === 'CUSTOMER') throw new Error('toAdminMeDto: a customer is not staff.');
  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    },
    permissions: effectivePermissions({ role: user.role, permissions: user.permissions }),
    mustChangePassword: user.mustChangePassword,
  };
}
