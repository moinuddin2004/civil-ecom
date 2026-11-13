import { parsePageSize } from '@/lib/admin/page-size';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditAction, type AuditEntity } from '@aricon/shared';
import type { Metadata } from 'next';
import { AccessDenied } from '@/components/admin/access-denied';
import { AuditLogView } from '@/components/admin/audit-log-view';
import { getAuditLogs, getStaffList, isAdmin, requireStaff } from '@/lib/admin-data';

export const metadata: Metadata = { title: 'Audit log' };

interface AuditLogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v ? v : undefined;
}

function oneOf<T extends string>(values: readonly T[], value: string | undefined): T | undefined {
  return (values as readonly string[]).includes(value ?? '') ? (value as T) : undefined;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * `/admin/audit-logs` (SPEC §10.13, ADMIN only, SPEC §4.3). Filters (`actor` = staff id, `entity`,
 * `action`, `from`, `to`) live in the query string; malformed values are dropped rather than sent.
 */
export default async function AdminAuditLogsPage({ searchParams }: AuditLogPageProps) {
  const me = await requireStaff();
  if (!isAdmin(me)) return <AccessDenied />;

  const sp = await searchParams;
  const actor = firstParam(sp.actor);
  const actorId = actor && OBJECT_ID.test(actor) ? actor : undefined;
  const entity = oneOf<AuditEntity>(AUDIT_ENTITIES, firstParam(sp.entity));
  const action = oneOf<AuditAction>(AUDIT_ACTIONS, firstParam(sp.action));
  const fromParam = firstParam(sp.from);
  const toParam = firstParam(sp.to);
  const from = fromParam && DATE_KEY.test(fromParam) ? fromParam : undefined;
  const to = toParam && DATE_KEY.test(toParam) ? toParam : undefined;
  const page = Math.max(1, Number(firstParam(sp.page)) || 1);
  const pageSize = parsePageSize(firstParam(sp.pageSize));

  const [logs, staff] = await Promise.all([
    getAuditLogs({ actorId, entity, action, from, to, page, pageSize }),
    getStaffList(),
  ]);

  return (
    <AuditLogView
      rows={logs.data}
      meta={logs.meta}
      actors={staff.map((member) => ({ id: member.id, name: member.name }))}
      query={{ actor: actorId ?? '', entity: entity ?? '', action: action ?? '', from: from ?? '', to: to ?? '' }}
    />
  );
}
