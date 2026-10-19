'use client';

import type { Permission, PermissionCatalogDTO } from '@aricon/shared';
import { withDependencies, withoutPermission } from '@aricon/shared';
import { useMemo } from 'react';
import { Checkbox, type CheckedState } from '@/components/ui/checkbox';
import { Pill } from '@/components/shop/status-badges';

export interface PermissionGroupEditorProps {
  group: PermissionCatalogDTO['groups'][number];
  checked: Permission[];
  onChange: (next: Permission[]) => void;
  disabled?: boolean;
}

/**
 * One collapsible permission group (DESIGN.md §9.5): a tri-state "Select all" checkbox in the
 * header plus one row per permission with a "Sensitive" badge where it applies. Ticking a box
 * applies `withDependencies()`; unticking applies `withoutPermission()` (SPEC §4.5 rule 1) — both
 * come straight from `packages/shared/src/permissions.ts`, nothing is reimplemented here.
 */
export function PermissionGroupEditor({ group, checked, onChange, disabled }: PermissionGroupEditorProps) {
  const checkedSet = useMemo(() => new Set(checked), [checked]);
  const groupKeys = group.permissions.map((p) => p.key);
  const checkedInGroup = groupKeys.filter((key) => checkedSet.has(key));
  const selectAllState: CheckedState =
    checkedInGroup.length === 0 ? false : checkedInGroup.length === groupKeys.length ? true : 'indeterminate';

  function togglePermission(key: Permission, next: boolean) {
    onChange(next ? withDependencies([...checked, key]) : withoutPermission(checked, key));
  }

  function toggleSelectAll(next: CheckedState) {
    if (next === true) {
      onChange(withDependencies([...checked, ...groupKeys]));
    } else {
      let result = checked;
      for (const key of groupKeys) result = withoutPermission(result, key);
      onChange(result);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-concrete-200">
      <div className="flex items-center justify-between gap-2 border-b border-concrete-200 bg-concrete-50 px-3 py-2">
        <span className="text-sm font-semibold text-ink">{group.group}</span>
        <label className="flex items-center gap-2 text-xs font-medium text-ink-700">
          Select all
          <Checkbox
            checked={selectAllState}
            onCheckedChange={toggleSelectAll}
            disabled={disabled}
            aria-label={`Select all ${group.group} permissions`}
          />
        </label>
      </div>
      <ul className="flex flex-col divide-y divide-concrete-150">
        {group.permissions.map((permission) => (
          <li key={permission.key} className="flex items-center gap-2.5 px-3 py-2">
            <Checkbox
              id={`perm-${permission.key}`}
              checked={checkedSet.has(permission.key)}
              onCheckedChange={(next) => togglePermission(permission.key, next === true)}
              disabled={disabled}
            />
            <label htmlFor={`perm-${permission.key}`} className="flex flex-1 items-center gap-2 text-sm text-ink">
              {permission.label}
              {permission.sensitive ? <Pill tone="warning" size="sm">Sensitive</Pill> : null}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
