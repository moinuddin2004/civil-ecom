import type { AuditAction, AuditEntity, Role } from '@aricon/shared';
import { createParamDecorator, Injectable, type ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Request } from 'express';
import { Types, type ClientSession, type Model } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { AuditLog } from '../../models/audit-log.model.js';
import { clientContext } from '../auth/auth-cookies.service.js';

/** Who did an admin write, and from where (SPEC §5.16). */
export interface AuditActor {
  id: string;
  name: string;
  role: Role;
  ip?: string;
  userAgent?: string;
}

/**
 * The signed-in staff member as an audit actor. Only on staff routes (the guard has already
 * authenticated the request).
 */
export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext): AuditActor => {
  const req = context.switchToHttp().getRequest<Request>();
  const principal = req.principal;
  if (!principal) throw AppError.unauthenticated();
  const client = clientContext(req);
  return { id: principal.userId, name: principal.name, role: principal.role, ip: client.ip, userAgent: client.userAgent };
});

export interface AuditEntry {
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  /** Only the fields that changed — never passwords, hashes or tokens. */
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/** Plain JSON form of a value, so ObjectIds/Dates compare and store predictably. */
function plain(value: unknown): unknown {
  return value === undefined ? null : (JSON.parse(JSON.stringify(value)) as unknown);
}

/** The listed fields as plain JSON, for the `after` of a "created" entry. */
export function snapshot<T extends object>(value: T, keys: readonly (keyof T & string)[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) out[key] = plain(value[key]);
  return out;
}

/**
 * The fields of `keys` whose value differs between `before` and `after`, as two small objects for
 * the audit log. Empty objects when nothing changed.
 */
export function changedFields<T extends object>(
  before: T,
  after: T,
  keys: readonly (keyof T & string)[],
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const result = { before: {} as Record<string, unknown>, after: {} as Record<string, unknown> };
  for (const key of keys) {
    const was = plain(before[key]);
    const now = plain(after[key]);
    if (JSON.stringify(was) !== JSON.stringify(now)) {
      result.before[key] = was;
      result.after[key] = now;
    }
  }
  return result;
}

/**
 * Append-only audit trail for the admin writes CLAUDE.md §31 lists. Pass the transaction's session
 * so the entry is written if and only if the change itself commits.
 */
@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private readonly model: Model<AuditLog>) {}

  async record(actor: AuditActor, entry: AuditEntry, session?: ClientSession): Promise<void> {
    await this.model.create(
      [
        {
          actorId: new Types.ObjectId(actor.id),
          actorName: actor.name,
          actorRole: actor.role,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          before: entry.before ?? {},
          after: entry.after ?? {},
          ip: actor.ip?.slice(0, 64),
          userAgent: actor.userAgent,
          at: new Date(),
        },
      ],
      { session },
    );
  }
}
