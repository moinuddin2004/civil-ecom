import { karachiDayEnd, karachiDayStart, type AuditLogDTO } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types, type Model } from 'mongoose';
import { Paginated } from '../../common/http/envelope.js';
import { AuditLog, type AuditLogLean } from '../../models/audit-log.model.js';
import type { AuditLogQueryDto } from './audit-logs.dto.js';

const { trusted } = mongoose;

const isEmpty = (value: Record<string, unknown> | undefined) => !value || Object.keys(value).length === 0;

/** Reads the audit trail for the admin page (SPEC §10.13). */
@Injectable()
export class AuditLogsService {
  constructor(@InjectModel(AuditLog.name) private readonly model: Model<AuditLog>) {}

  async list(query: AuditLogQueryDto): Promise<Paginated<AuditLogDTO>> {
    const filter: Record<string, unknown> = {};
    if (query.actorId) filter.actorId = new Types.ObjectId(query.actorId);
    if (query.entity) filter.entity = query.entity;
    if (query.entityId) filter.entityId = query.entityId;
    if (query.action) filter.action = query.action;
    if (query.from || query.to) {
      filter.at = trusted({
        ...(query.from && { $gte: karachiDayStart(query.from) }),
        ...(query.to && { $lt: karachiDayEnd(query.to) }),
      });
    }
    const [rows, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ at: -1, _id: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .lean<AuditLogLean[]>()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return new Paginated(
      rows.map((row) => ({
        id: String(row._id),
        at: row.at.toISOString(),
        actorId: String(row.actorId),
        actorName: row.actorName,
        actorRole: row.actorRole,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        before: isEmpty(row.before) ? null : (row.before ?? null),
        after: isEmpty(row.after) ? null : (row.after ?? null),
        ip: row.ip ?? null,
      })),
      { page: query.page, pageSize: query.pageSize, total },
    );
  }
}
