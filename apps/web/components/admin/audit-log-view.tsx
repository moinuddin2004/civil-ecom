'use client';

import { AUDIT_ACTIONS, AUDIT_ENTITIES, formatDateTime, ROLE_LABELS, type AuditLogDTO, type PageMeta } from '@aricon/shared';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { AccessDenied } from '@/components/admin/access-denied';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from '@/lib/admin/audit-log-labels';
import { useAdminSession } from '@/lib/admin/session';
import { cn } from '@/lib/utils';

export interface AuditLogViewProps {
  rows: AuditLogDTO[];
  meta: PageMeta;
  /** Staff who can appear as the actor (id → name). */
  actors: { id: string; name: string }[];
  query: { actor: string; entity: string; action: string; from: string; to: string };
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function entityHref(row: AuditLogDTO): string | null {
  if (row.entity === 'order') return `/admin/orders/${row.entityId}`;
  if (row.entity === 'product') return `/admin/products/${row.entityId}`;
  return null;
}

/** "Order …a1b2c3": the kind of thing plus the end of its id (settings/homepage have no id). */
function entityLabel(row: AuditLogDTO): string {
  const label = AUDIT_ENTITY_LABELS[row.entity];
  return /^[a-f0-9]{24}$/i.test(row.entityId) ? `${label} …${row.entityId.slice(-6)}` : label;
}

/** Short summary derived from the action name, e.g. "paymentStatus: Awaiting verification → Paid". */
function summarize(row: AuditLogDTO): string {
  const keys = Array.from(new Set([...Object.keys(row.before ?? {}), ...Object.keys(row.after ?? {})]));
  // Some entries repeat an identifying field on both sides (e.g. the SKU of a stock adjustment).
  const key = keys.find((k) => formatValue(row.before?.[k]) !== formatValue(row.after?.[k])) ?? keys[0];
  if (!key) return AUDIT_ACTION_LABELS[row.action];
  return `${key}: ${formatValue(row.before?.[key])} → ${formatValue(row.after?.[key])}`;
}

function DiffRow({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  if (keys.length === 0) return <p className="text-sm text-cement">No field-level detail recorded.</p>;
  return (
    <table className="w-full max-w-160 text-sm">
      <thead>
        <tr className="text-left text-xs text-cement">
          <th className="py-1 pr-3 font-medium">Field</th>
          <th className="py-1 pr-3 font-medium">Before</th>
          <th className="py-1 font-medium">After</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => (
          <tr key={key} className="border-t border-concrete-150">
            <td className="py-1.5 pr-3 font-medium text-ink">{key}</td>
            <td className="py-1.5 pr-3 text-ink-700">{formatValue(before?.[key])}</td>
            <td className="py-1.5 text-ink-700">{formatValue(after?.[key])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** `/admin/audit-logs` (SPEC §10.13, ADMIN only — no permission grants access, SPEC §4.3). */
export function AuditLogView({ rows, meta, actors, query }: AuditLogViewProps) {
  const { me } = useAdminSession();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!me || me.user.role !== 'ADMIN') return <AccessDenied />;

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="type-h1">Audit log</h1>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-actor" className="text-xs text-cement">
            Actor
          </label>
          <Select id="audit-actor" name="actor" size="sm" defaultValue={query.actor} placeholder="Anyone" options={actors.map((actor) => ({ value: actor.id, label: actor.name }))} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-entity" className="text-xs text-cement">
            Entity
          </label>
          <Select id="audit-entity" name="entity" size="sm" defaultValue={query.entity} placeholder="Any entity" options={AUDIT_ENTITIES.map((entity) => ({ value: entity, label: AUDIT_ENTITY_LABELS[entity] }))} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-action" className="text-xs text-cement">
            Action
          </label>
          <Select
            id="audit-action"
            name="action"
            size="sm"
            defaultValue={query.action}
            placeholder="Any action"
            options={AUDIT_ACTIONS.map((action) => ({ value: action, label: AUDIT_ACTION_LABELS[action] }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-from" className="text-xs text-cement">
            From
          </label>
          <input
            id="audit-from"
            type="date"
            name="from"
            defaultValue={query.from}
            className="h-9 rounded-md border border-concrete-400 bg-surface px-2.5 text-sm text-ink"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-to" className="text-xs text-cement">
            To
          </label>
          <input
            id="audit-to"
            type="date"
            name="to"
            defaultValue={query.to}
            className="h-9 rounded-md border border-concrete-400 bg-surface px-2.5 text-sm text-ink"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary">
          Filter
        </Button>
        {query.actor || query.entity || query.action || query.from || query.to ? (
          <Button variant="tertiary" size="sm" asChild>
            <Link href="/admin/audit-logs">Clear</Link>
          </Button>
        ) : null}
      </form>

      <div className="overflow-x-auto rounded-xl border border-concrete-150 bg-surface shadow-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-concrete-150 bg-concrete-50 text-left text-xs text-cement">
              <th className="w-8 px-3 py-2.5" />
              <th className="px-4 py-2.5 font-medium">Time</th>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
              <th className="px-4 py-2.5 font-medium">Entity</th>
              <th className="px-4 py-2.5 font-medium">Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = entityHref(row);
              const isOpen = expanded.has(row.id);
              return (
                <Fragment key={row.id}>
                  <tr className="border-b border-concrete-150 last:border-b-0 hover:bg-concrete-50">
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggle(row.id)}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? 'Hide details' : 'Show details'}
                        className="flex size-6 items-center justify-center rounded text-ink-700 hover:bg-concrete-100"
                      >
                        <ChevronDown aria-hidden strokeWidth={1.75} className={cn('size-4 transition-transform', isOpen && 'rotate-180')} />
                      </button>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink-700">{formatDateTime(row.at)}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-ink">{row.actorName}</span>{' '}
                      <span className="text-xs text-cement">{ROLE_LABELS[row.actorRole]}</span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-700">{AUDIT_ACTION_LABELS[row.action]}</td>
                    <td className="px-4 py-2.5">
                      {href ? (
                        <Link href={href} className="text-blueprint hover:text-blueprint-700">
                          {entityLabel(row)}
                        </Link>
                      ) : (
                        <span className="text-ink-700">{entityLabel(row)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-700">{summarize(row)}</td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-b border-concrete-150 bg-concrete-50 last:border-b-0">
                      <td />
                      <td colSpan={5} className="px-4 py-3">
                        <DiffRow before={row.before} after={row.after} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-cement">
                  No audit log entries match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <AdminPagination
        basePath="/admin/audit-logs"
        query={{
          actor: query.actor || undefined,
          entity: query.entity || undefined,
          action: query.action || undefined,
          from: query.from || undefined,
          to: query.to || undefined,
        }}
        meta={meta}
      />
    </div>
  );
}
