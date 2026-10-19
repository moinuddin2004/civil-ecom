import type { Permission, Role, UserStatus } from '@aricon/shared';
import type { Audience } from '../../models/refresh-token.model.js';

export type { Audience };

/**
 * The authenticated caller, attached to the request by the auth guard. Built from the database on
 * every request (≤ 30 s cache), never from token claims, so a role change or block applies at once.
 */
export interface Principal {
  userId: string;
  audience: Audience;
  role: Role;
  status: UserStatus;
  /** Effective permissions: every permission for ADMIN, the stored list for STAFF, none for customers. */
  permissions: Permission[];
  mustChangePassword: boolean;
  name: string;
  email: string;
  /** Refresh-token family of the login this access token came from. */
  familyId: string;
}

/** Who may call an endpoint. Every route declares one; a route without a policy is refused. */
export type AuthPolicy =
  | { kind: 'public' }
  | { kind: 'customer' }
  | {
      kind: 'staff';
      /** All of these are required. */
      allOf?: Permission[];
      /** At least one of these is required. */
      anyOf?: Permission[];
      /** ADMIN role only: staff management, settings, audit log (SPEC §4.3). */
      adminOnly?: boolean;
    };

/** What a freshly issued pair of tokens looks like (cookies are set from this). */
export interface IssuedTokens {
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  refreshExpiresAt: Date;
  familyId: string;
}

/** Where a request came from; stored on refresh tokens for incident review only. */
export interface ClientContext {
  ip?: string;
  userAgent?: string;
}

/** JWT access-token claims. Deliberately minimal: everything else is loaded from the database. */
export interface AccessClaims {
  sub: string;
  aud: Audience;
  /** Refresh-token family (lets change-password keep this login while signing out others). */
  fam: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}
