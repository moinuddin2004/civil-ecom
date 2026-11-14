import {
  permissionCatalog,
  withDependencies,
  type AuditAction,
  type PermissionCatalogDTO,
  type StaffDTO,
  type TemporaryPasswordDTO,
} from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { isDuplicateKey } from '../../common/errors/mongo-errors.js';
import { TransactionService } from '../../database/transaction.service.js';
import { Counter } from '../../models/counter.model.js';
import type { User, UserLean } from '../../models/user.model.js';
import {
  AuditService,
  changedFields,
  snapshot,
  type AuditActor,
} from '../audit/audit.service.js';
import { AuthUserCache } from '../auth/auth-user-cache.service.js';
import { EmailVerificationService } from '../auth/email-verification.service.js';
import { PasswordHasher } from '../auth/password-hasher.service.js';
import { TokenService } from '../auth/token.service.js';
import { UsersRepository } from '../users/users.repository.js';
import type { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto.js';

const STAFF_NOT_FOUND = "We couldn't find that staff member.";
const EMAIL_TAKEN =
  'An account with this email already exists. Staff need their own email (a customer account can’t become staff).';
const PHONE_TAKEN = 'Another account already uses this mobile number.';
const RESTORE_EMAIL_TAKEN =
  'An active account already uses this email. Change that account before restoring this one.';
const LAST_ADMIN =
  'Keep at least one active admin. Make someone else an admin first.';

/** Counter document every admin role/status change bumps, so two such changes can't race (see below). */
const ADMIN_CHANGES_LOCK = 'staff-admin-changes';

export function toStaffDto(user: UserLean): StaffDTO {
  if (user.role === 'CUSTOMER')
    throw new Error('toStaffDto: a customer is not staff.');
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    permissions: [...user.permissions],
    mustChangePassword: user.mustChangePassword,
    // Legacy documents may predate the field until the startup backfill has run.
    emailVerified: user.emailVerified !== false,
    createdAt: user.createdAt.toISOString(),
    deletedAt: user.deletedAt?.toISOString() ?? null,
  };
}

/**
 * Staff accounts and permissions (SPEC §4.5, §7.3), ADMIN only. Every role, permission and status
 * change is audited with before/after; blocking or a role change signs the person out everywhere.
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly users: UsersRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly cache: AuthUserCache,
    private readonly verifications: EmailVerificationService,
    private readonly audit: AuditService,
    @InjectModel(Counter.name) private readonly counters: Model<Counter>,
  ) {}

  catalog(): PermissionCatalogDTO {
    return permissionCatalog();
  }

  async list(): Promise<StaffDTO[]> {
    return (await this.users.findStaff()).map(toStaffDto);
  }

  /** The temporary password is returned once; it is never stored in plain text, logged or emailed. */
  async create(
    actor: AuditActor,
    input: CreateStaffDto,
  ): Promise<TemporaryPasswordDTO> {
    if (await this.users.activeEmailExists(input.email))
      throw new AppError('EMAIL_TAKEN', EMAIL_TAKEN);
    if (input.phone && (await this.users.activePhoneExists(input.phone)))
      throw new AppError('PHONE_TAKEN', PHONE_TAKEN);

    const temporaryPassword = this.hasher.temporaryPassword();
    const passwordHash = await this.hasher.hash(temporaryPassword);
    try {
      const staff = await this.transactions.run(async (session) => {
        const created = await this.users.create(
          {
            name: input.name,
            email: input.email,
            phone: input.phone,
            passwordHash,
            role: input.role,
            // Stored with dependencies applied (SPEC §4.5 rule 1); meaningless for ADMIN, so kept empty.
            permissions:
              input.role === 'STAFF'
                ? withDependencies(input.permissions ?? [])
                : [],
            mustChangePassword: true,
          },
          session,
        );
        await this.audit.record(
          actor,
          {
            action: 'user.created',
            entity: 'user',
            entityId: String(created._id),
            after: snapshot(created, [
              'name',
              'email',
              'phone',
              'role',
              'permissions',
              'status',
            ]),
          },
          session,
        );
        return created;
      });
      await this.verifications.send(staff, { force: true });
      return { staff: toStaffDto(staff), temporaryPassword };
    } catch (error) {
      if (isDuplicateKey(error, 'phone'))
        throw new AppError('PHONE_TAKEN', PHONE_TAKEN);
      if (isDuplicateKey(error, 'email'))
        throw new AppError('EMAIL_TAKEN', EMAIL_TAKEN);
      throw error;
    }
  }

  async update(
    actor: AuditActor,
    id: string,
    input: UpdateStaffDto,
  ): Promise<StaffDTO> {
    if (input.phone && (await this.users.phoneTakenByOther(input.phone, id)))
      throw new AppError('PHONE_TAKEN', PHONE_TAKEN);

    let result: { before: UserLean; after: UserLean };
    try {
      result = await this.transactions.run(async (session) => {
        const before = await this.findStaff(id, session);
        const set: Partial<
          Pick<User, 'name' | 'phone' | 'role' | 'permissions' | 'status'>
        > = {};
        if (input.name !== undefined) set.name = input.name;
        if (input.phone) set.phone = input.phone;
        if (input.role !== undefined) set.role = input.role;
        if (input.status !== undefined) set.status = input.status;
        if (input.permissions !== undefined)
          set.permissions = withDependencies(input.permissions);

        await this.assertAdminRules(actor, before, set, session);
        const after = await this.users.updateFields(
          id,
          set,
          input.phone === null ? ['phone'] : [],
          session,
        );
        if (!after) throw AppError.notFound(STAFF_NOT_FOUND);
        await this.auditChanges(actor, before, after, session);
        return { before, after };
      });
    } catch (error) {
      if (isDuplicateKey(error, 'phone'))
        throw new AppError('PHONE_TAKEN', PHONE_TAKEN);
      throw error;
    }

    const { before, after } = result;
    // SPEC §4.5 rule 5: blocking or a role change ends every session at once.
    if (after.status === 'blocked' && before.status !== 'blocked') {
      await this.tokens.revokeAllForUser(id, 'blocked');
    } else if (after.role !== before.role) {
      await this.tokens.revokeAllForUser(id, 'role_changed');
    }
    this.cache.invalidate(id); // permissions/role/status are read per request
    return toStaffDto(after);
  }

  /** A new temporary password (shown once); signs them out and forces a change at next login. */
  async resetPassword(
    actor: AuditActor,
    id: string,
  ): Promise<TemporaryPasswordDTO> {
    const temporaryPassword = this.hasher.temporaryPassword();
    const passwordHash = await this.hasher.hash(temporaryPassword);
    const staff = await this.transactions.run(async (session) => {
      await this.findStaff(id, session);
      await this.users.setTemporaryPassword(id, passwordHash, session);
      await this.audit.record(
        actor,
        { action: 'user.password_reset', entity: 'user', entityId: id },
        session,
      );
      return this.findStaff(id, session);
    });
    await this.tokens.revokeAllForUser(id, 'password_changed');
    this.cache.invalidate(id);
    if (staff.emailVerified === false) await this.verifications.send(staff, { force: true });
    return { staff: toStaffDto(staff), temporaryPassword };
  }

  /** Admin override for staff whose verification email never arrived. Idempotent (no repeat audit). */
  async verifyEmail(actor: AuditActor, id: string): Promise<StaffDTO> {
    const staff = await this.transactions.run(async (session) => {
      const before = await this.findStaff(id, session);
      if (before.emailVerified !== false) return before;

      await this.users.markEmailVerified(id, new Date(), session);
      await this.audit.record(
        actor,
        {
          action: 'user.email_verified',
          entity: 'user',
          entityId: id,
          before: { emailVerified: false },
          after: { emailVerified: true },
        },
        session,
      );
      return this.findStaff(id, session);
    });
    this.cache.invalidate(id);
    return toStaffDto(staff);
  }

  async delete(actor: AuditActor, id: string): Promise<StaffDTO> {
    const result = await this.transactions.run(async (session) => {
      const before = await this.findStaff(id, session, true);
      if (before.deletedAt) return { staff: before, changed: false };

      await this.assertAdminRules(actor, before, {}, session, true);
      const deletedAt = new Date();
      const after = await this.users.updateFields(
        id,
        { deletedAt },
        [],
        session,
      );
      if (!after) throw AppError.notFound(STAFF_NOT_FOUND);
      await this.audit.record(
        actor,
        {
          action: 'user.deleted',
          entity: 'user',
          entityId: id,
          before: { deletedAt: null },
          after: { deletedAt },
        },
        session,
      );
      return { staff: after, changed: true };
    });

    if (result.changed) {
      await this.tokens.revokeAllForUser(id, 'deleted');
      this.cache.invalidate(id);
    }
    return toStaffDto(result.staff);
  }

  async restore(actor: AuditActor, id: string): Promise<StaffDTO> {
    let restored: UserLean;
    try {
      restored = await this.transactions.run(async (session) => {
        const before = await this.findStaff(id, session, true);
        if (!before.deletedAt) return before;
        if (await this.users.emailTakenByOther(before.email, id))
          throw new AppError('EMAIL_TAKEN', RESTORE_EMAIL_TAKEN);
        if (
          before.phone &&
          (await this.users.phoneTakenByOther(before.phone, id))
        )
          throw new AppError('PHONE_TAKEN', PHONE_TAKEN);

        const after = await this.users.updateFields(
          id,
          {},
          ['deletedAt'],
          session,
        );
        if (!after) throw AppError.notFound(STAFF_NOT_FOUND);
        await this.audit.record(
          actor,
          {
            action: 'user.restored',
            entity: 'user',
            entityId: id,
            before: { deletedAt: before.deletedAt },
            after: { deletedAt: null },
          },
          session,
        );
        return after;
      });
    } catch (error) {
      if (isDuplicateKey(error, 'phone'))
        throw new AppError('PHONE_TAKEN', PHONE_TAKEN);
      if (isDuplicateKey(error, 'email'))
        throw new AppError('EMAIL_TAKEN', RESTORE_EMAIL_TAKEN);
      throw error;
    }
    this.cache.invalidate(id);
    return toStaffDto(restored);
  }

  private async findStaff(
    id: string,
    session: ClientSession,
    includeDeleted = false,
  ): Promise<UserLean> {
    const user = await this.users.findById(id, session);
    // Customers are managed under Customers; this endpoint never touches them (SPEC §4.5 rule 7).
    if (
      !user ||
      user.role === 'CUSTOMER' ||
      (user.deletedAt && !includeDeleted)
    )
      throw AppError.notFound(STAFF_NOT_FOUND);
    return user;
  }

  /**
   * SPEC §4.5 rule 4: no changing your own role or blocking yourself, and never leave the shop without
   * an active admin. The lock document makes concurrent admin changes conflict, so two admins can't
   * demote each other at the same moment and both pass the "another admin exists" check.
   */
  private async assertAdminRules(
    actor: AuditActor,
    before: UserLean,
    set: Partial<Pick<User, 'role' | 'status'>>,
    session: ClientSession,
    deleting = false,
  ): Promise<void> {
    const roleChanges = set.role !== undefined && set.role !== before.role;
    const blocking = set.status === 'blocked' && before.status !== 'blocked';
    if (
      String(before._id) === actor.id &&
      (roleChanges || blocking || deleting)
    ) {
      throw AppError.conflict(
        "You can't change your own role, block yourself or delete your own account.",
      );
    }

    const losesAdmin =
      before.role === 'ADMIN' &&
      before.status === 'active' &&
      ((roleChanges && set.role !== 'ADMIN') || blocking || deleting);
    if (!losesAdmin) return;
    await this.counters
      .updateOne(
        { _id: ADMIN_CHANGES_LOCK },
        { $inc: { seq: 1 } },
        { upsert: true, session },
      )
      .exec();
    if (
      (await this.users.countOtherActiveAdmins(String(before._id), session)) ===
      0
    )
      throw AppError.conflict(LAST_ADMIN);
  }

  /** One audit entry per kind of change (SPEC §4.5 rule 6), each with its own before/after. */
  private async auditChanges(
    actor: AuditActor,
    before: UserLean,
    after: UserLean,
    session: ClientSession,
  ): Promise<void> {
    const entityId = String(after._id);
    const entries: {
      action: AuditAction;
      keys: readonly ('name' | 'phone' | 'role' | 'permissions' | 'status')[];
    }[] = [
      { action: 'user.updated', keys: ['name', 'phone'] },
      { action: 'user.role_changed', keys: ['role'] },
      { action: 'user.permissions_changed', keys: ['permissions'] },
      {
        action: after.status === 'blocked' ? 'user.blocked' : 'user.unblocked',
        keys: ['status'],
      },
    ];
    for (const entry of entries) {
      const diff = changedFields(before, after, entry.keys);
      if (Object.keys(diff.after).length > 0) {
        await this.audit.record(
          actor,
          { action: entry.action, entity: 'user', entityId, ...diff },
          session,
        );
      }
    }
  }
}
