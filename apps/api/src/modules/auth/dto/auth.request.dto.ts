import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  IsNormalizedEmail,
  IsOptionalText,
  IsPersonName,
  IsPkPhone,
  IsStrongPassword,
} from '../../../common/validation/validators.js';

/*
 * Request bodies for the auth endpoints (SPEC §7.2–7.3). Unknown fields are rejected by the global
 * validation pipe, so a public request can never set `role` or `permissions` (CLAUDE.md §26).
 */

/** `POST /api/auth/signup`: always creates a CUSTOMER. */
export class SignupDto {
  @ApiProperty({ example: 'Ahmed Raza' })
  @IsPersonName()
  name!: string;

  @ApiProperty({ example: 'ahmed@example.com' })
  @IsNormalizedEmail()
  email!: string;

  @ApiProperty({ example: '0300 1234567', description: 'Any common format; stored as +923XXXXXXXXX.' })
  @IsPkPhone()
  phone!: string;

  @ApiProperty({ example: 'Cement2026', minLength: 8, maxLength: 72 })
  @IsStrongPassword()
  password!: string;

  @ApiPropertyOptional({ example: 'Raza Builders' })
  @IsOptionalText(120)
  companyName?: string;
}

/** `POST /api/auth/login`: email or mobile number. */
export class LoginDto {
  @ApiProperty({ example: 'ahmed@example.com', description: 'Email or mobile number.' })
  @IsString({ message: 'Enter your email or mobile number.' })
  @MinLength(1, { message: 'Enter your email or mobile number.' })
  @MaxLength(254)
  identifier!: string;

  @ApiProperty({ example: 'Cement2026' })
  @IsString({ message: 'Enter your password.' })
  @MinLength(1, { message: 'Enter your password.' })
  @MaxLength(200)
  password!: string;
}

/** `POST /api/admin/auth/login`. */
export class AdminLoginDto {
  @ApiProperty({ example: 'admin@aricon.com.pk' })
  @IsNormalizedEmail()
  email!: string;

  @ApiProperty()
  @IsString({ message: 'Enter your password.' })
  @MinLength(1, { message: 'Enter your password.' })
  @MaxLength(200)
  password!: string;
}

/** `POST /api/auth/forgot-password`. */
export class ForgotPasswordDto {
  @ApiProperty({ example: 'ahmed@example.com' })
  @IsNormalizedEmail()
  email!: string;
}

/** `POST /api/auth/reset-password`. Tokens are 32 random bytes, base64url (43 characters). */
export class ResetPasswordDto {
  @ApiProperty({ description: 'The token from the reset link.' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'This reset link is not valid.' })
  token!: string;

  @ApiProperty({ example: 'NewCement2026' })
  @IsStrongPassword()
  password!: string;
}

/** `POST /api/auth/verify-email`. Same 32-byte token format as password resets. */
export class VerifyEmailDto {
  @ApiProperty({ description: 'The token from the verification link.' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'This verification link is not valid.' })
  token!: string;
}

/** `POST /api/auth/resend-verification`. The answer is the same whether the email exists. */
export class ResendVerificationDto {
  @ApiProperty({ example: 'ahmed@example.com' })
  @IsNormalizedEmail()
  email!: string;
}

/** `POST /api/admin/auth/change-password` (and later `/api/account/change-password`). */
export class ChangePasswordDto {
  @ApiProperty()
  @IsString({ message: 'Enter your current password.' })
  @MinLength(1, { message: 'Enter your current password.' })
  @MaxLength(200)
  currentPassword!: string;

  @ApiProperty({ example: 'NewCement2026' })
  @IsStrongPassword()
  newPassword!: string;
}
