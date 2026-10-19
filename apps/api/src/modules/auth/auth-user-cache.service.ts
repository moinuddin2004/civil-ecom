import { effectivePermissions, type Permission, type Role, type UserStatus } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository.js';

/** SPEC §3.2: "loaded from the database on every request (cache at most 30 s in memory)". */
const TTL_MS = 30_000;
/** One API process on a small VPS: bound the memory a burst of distinct users can take. */
const MAX_ENTRIES = 5_000;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  permissions: Permission[];
  mustChangePassword: boolean;
}

interface Entry {
  user: AuthUser | null;
  expiresAt: number;
}

/**
 * The user's role, status and permissions as of (at most) 30 seconds ago. Services that change them
 * (block, role/permission change, password change) call `invalidate()` so the change applies to the
 * very next request instead of after the cache window.
 */
@Injectable()
export class AuthUserCache {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly users: UsersRepository) {}

  async get(userId: string, now = Date.now()): Promise<AuthUser | null> {
    const cached = this.entries.get(userId);
    if (cached && cached.expiresAt > now) return cached.user;

    const view = await this.users.findAuthView(userId);
    const user: AuthUser | null = view
      ? {
          id: String(view._id),
          name: view.name,
          email: view.email,
          role: view.role,
          status: view.status,
          permissions: effectivePermissions({ role: view.role, permissions: view.permissions }),
          mustChangePassword: view.mustChangePassword,
        }
      : null;

    this.entries.delete(userId);
    if (this.entries.size >= MAX_ENTRIES) {
      // Maps iterate in insertion order: drop the oldest entry.
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(userId, { user, expiresAt: now + TTL_MS });
    return user;
  }

  invalidate(userId: string): void {
    this.entries.delete(userId);
  }
}
