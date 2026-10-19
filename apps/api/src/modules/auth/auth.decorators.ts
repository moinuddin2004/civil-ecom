import type { Permission } from '@aricon/shared';
import { applyDecorators, createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import type { AuthPolicy, Principal } from './auth.types.js';

export const AUTH_POLICY = 'aricon:auth-policy';
export const ALLOW_DURING_PASSWORD_CHANGE = 'aricon:allow-during-password-change';

function policy(value: AuthPolicy) {
  return SetMetadata(AUTH_POLICY, value);
}

/** No sign-in needed (catalog, login, health…). */
export const Public = () => policy({ kind: 'public' });

/** A signed-in customer (storefront account, cart, orders). Staff tokens never pass (SPEC §3.2). */
export const CustomerOnly = () =>
  applyDecorators(policy({ kind: 'customer' }), ApiCookieAuth('customer'), ApiBearerAuth('bearer'));

/** Any signed-in staff member or admin. */
export const StaffOnly = () =>
  applyDecorators(policy({ kind: 'staff' }), ApiCookieAuth('admin'), ApiBearerAuth('bearer'));

/** Staff with **all** of these permissions (ADMIN always passes) — `requirePermission()` in SPEC §4. */
export const RequirePermission = (...permissions: Permission[]) =>
  applyDecorators(policy({ kind: 'staff', allOf: permissions }), ApiCookieAuth('admin'), ApiBearerAuth('bearer'));

/** Staff with **at least one** of these permissions (e.g. "products.view or categories.manage"). */
export const RequireAnyPermission = (...permissions: Permission[]) =>
  applyDecorators(policy({ kind: 'staff', anyOf: permissions }), ApiCookieAuth('admin'), ApiBearerAuth('bearer'));

/** ADMIN role only, no permission grants it — `requireAdmin()` in SPEC §4.3. */
export const RequireAdmin = () =>
  applyDecorators(policy({ kind: 'staff', adminOnly: true }), ApiCookieAuth('admin'), ApiBearerAuth('bearer'));

/**
 * Lets a staff member with a forced password change still call this endpoint (SPEC §6.11: until
 * they change it, only `/api/admin/auth/*` works).
 */
export const AllowDuringPasswordChange = () => SetMetadata(ALLOW_DURING_PASSWORD_CHANGE, true);

/** The signed-in caller (only on endpoints with a customer or staff policy). */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): Principal => {
  const principal = context.switchToHttp().getRequest<Request>().principal;
  // A handler asking for the user on a public route is a programming error, not a client error.
  if (!principal) throw AppError.unauthenticated();
  return principal;
});
