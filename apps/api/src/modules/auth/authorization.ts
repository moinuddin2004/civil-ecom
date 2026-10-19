import { hasPermission } from '@aricon/shared';
import { AppError } from '../../common/errors/app-error.js';
import type { AuthPolicy, Principal } from './auth.types.js';

/**
 * Whether `principal` satisfies a staff policy (SPEC §4). Pure, so the rules are unit-tested
 * directly. Throws `FORBIDDEN` with a plain message; the UI hides what the user can't do, but this
 * is what actually enforces it (CLAUDE.md §25: hiding a button is not authorization).
 */
export function assertAuthorized(principal: Principal, policy: Extract<AuthPolicy, { kind: 'staff' }>): void {
  const subject = { role: principal.role, permissions: principal.permissions };

  if (policy.adminOnly && principal.role !== 'ADMIN') {
    throw AppError.forbidden('Only admins can do this.');
  }
  if (policy.allOf?.some((permission) => !hasPermission(subject, permission))) {
    throw AppError.forbidden("You don't have permission to do this. Ask an admin for access.");
  }
  if (policy.anyOf?.length && !policy.anyOf.some((permission) => hasPermission(subject, permission))) {
    throw AppError.forbidden("You don't have permission to do this. Ask an admin for access.");
  }
}
