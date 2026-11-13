'use client';

import {
  USER_STATUSES,
  withDependencies,
  type AdminMeDTO,
  type ApiResponse,
  type Permission,
  type PermissionCatalogDTO,
  type StaffCreateInput,
  type StaffDTO,
  type StaffUpdateInput,
  type TemporaryPasswordDTO,
} from '@aricon/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetBody,
  SheetCloseButton,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select } from '@/components/ui/select';
import { staffFormSchema, type StaffFormData, type StaffFormInput } from '@/lib/admin/staff-form-schema';
import { staffGuard } from '@/lib/admin/staff-guards';
import { apiClient } from '@/lib/api-client';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';
import { PermissionGroupEditor } from './permission-group-editor';

const STATUS_LABELS: Record<'active' | 'blocked', string> = { active: 'Active', blocked: 'Blocked' };

/** Form fields the API can report errors for; anything else (e.g. a permission) is shown above the buttons. */
const FORM_FIELDS = ['name', 'email', 'phone', 'role', 'status'] as const;

export interface StaffFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  /** Required for `mode: 'edit'`. */
  staffMember?: StaffDTO;
  catalog: PermissionCatalogDTO;
  allStaff: StaffDTO[];
  me: AdminMeDTO;
  /** After "Add staff": the new account and its one-time temporary password. */
  onCreated: (result: TemporaryPasswordDTO) => void;
}

/**
 * Add/edit staff side sheet (SPEC §10.8, DESIGN.md §9.5) — the centerpiece of the Users page.
 * "Add" is `POST /api/admin/staff` (new accounts start active, with a temporary password the API
 * generates); "Save changes" is `PATCH /api/admin/staff/:id`. The API adds permission dependencies
 * and enforces the last-admin and self rules; its message is shown here when it refuses.
 */
export function StaffFormSheet({ open, onOpenChange, mode, staffMember, catalog, allStaff, me, onCreated }: StaffFormSheetProps) {
  const router = useRouter();
  const [permissions, setPermissions] = useState<Permission[]>(
    staffMember && staffMember.role === 'STAFF' ? staffMember.permissions : catalog.defaultStaffPermissions,
  );
  const [presetValue, setPresetValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<StaffFormInput, unknown, StaffFormData>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      name: staffMember?.name ?? '',
      email: staffMember?.email ?? '',
      phone: staffMember?.phone ?? '',
      role: staffMember?.role ?? 'STAFF',
      status: staffMember?.status ?? 'active',
    },
  });
  const submitting = form.formState.isSubmitting;

  // No reset effect: the parent gives this sheet a new `key` each time it opens, so the initial
  // state above is always for the staff member it was opened for.
  const role = useWatch({ control: form.control, name: 'role' });

  const guard = mode === 'edit' && staffMember ? staffGuard(staffMember, me, allStaff) : null;

  function applyPreset(key: string) {
    const preset = catalog.presets.find((p) => p.key === key);
    if (preset) setPermissions(withDependencies(preset.permissions));
    setPresetValue('');
  }

  async function create(values: StaffFormData) {
    const body: StaffCreateInput = {
      name: values.name,
      email: values.email,
      role: values.role,
      ...(values.phone ? { phone: values.phone } : {}),
      // ADMIN has every permission anyway; the API stores none for them.
      ...(values.role === 'STAFF' ? { permissions } : {}),
    };
    const { data } = await apiClient<ApiResponse<TemporaryPasswordDTO>>('/admin/staff', { method: 'POST', body });
    toast.success('Staff member added');
    onOpenChange(false);
    onCreated(data);
    router.refresh();
  }

  async function update(member: StaffDTO, values: StaffFormData) {
    const nextRole = guard?.roleLocked ? member.role : values.role;
    const body: StaffUpdateInput = {
      name: values.name,
      phone: values.phone || null,
      role: nextRole,
      status: guard?.statusLocked ? member.status : values.status,
      ...(nextRole === 'STAFF' ? { permissions } : {}),
    };
    await apiClient<ApiResponse<StaffDTO>>(`/admin/staff/${member.id}`, { method: 'PATCH', body });
    toast.success('Staff member updated');
    onOpenChange(false);
    router.refresh();
  }

  async function onSubmit(values: StaffFormData) {
    setFormError(null);
    try {
      if (mode === 'create') await create(values);
      else if (staffMember) await update(staffMember, values);
    } catch (error) {
      if (!applyFieldErrors(error, form.setError, { fields: FORM_FIELDS })) setFormError(errorMessage(error));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="lg" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{mode === 'create' ? 'Add staff member' : 'Edit staff member'}</SheetTitle>
          <SheetCloseButton />
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <SheetBody>
            <FormField label="Name" htmlFor="staff-name" error={form.formState.errors.name?.message} required>
              <Input id="staff-name" size="sm" {...form.register('name')} />
            </FormField>

            {mode === 'edit' ? (
              <FormField label="Email" htmlFor="staff-email" hint="Can't be changed">
                <Input id="staff-email" size="sm" value={staffMember?.email ?? ''} disabled readOnly />
              </FormField>
            ) : (
              <FormField label="Email" htmlFor="staff-email" error={form.formState.errors.email?.message} required>
                <Input id="staff-email" size="sm" type="email" {...form.register('email')} />
              </FormField>
            )}

            <FormField label="Phone" htmlFor="staff-phone" error={form.formState.errors.phone?.message} hint="Optional, e.g. 0300 1234567">
              <Input id="staff-phone" size="sm" {...form.register('phone')} />
            </FormField>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Role</span>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={Boolean(guard?.roleLocked)}
                    className="flex flex-row flex-wrap gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="STAFF" id="role-staff" />
                      <Label htmlFor="role-staff" disabled={guard?.roleLocked}>Staff</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="ADMIN" id="role-admin" />
                      <Label htmlFor="role-admin" disabled={guard?.roleLocked}>Admin</Label>
                    </div>
                  </RadioGroup>
                )}
              />
              {form.formState.errors.role?.message ? (
                <p className="text-sm text-danger">{form.formState.errors.role.message}</p>
              ) : null}
              {guard?.message ? <p className="text-sm text-danger">{guard.message}</p> : null}
            </div>

            {mode === 'edit' ? (
              <FormField label="Status" htmlFor="staff-status" error={form.formState.errors.status?.message}>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select
                      id="staff-status"
                      size="sm"
                      disabled={Boolean(guard?.statusLocked)}
                      value={field.value}
                      onValueChange={field.onChange}
                      options={USER_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                    />
                  )}
                />
              </FormField>
            ) : null}

            {role === 'ADMIN' ? (
              <p className="rounded-md bg-blueprint-50 px-3 py-2.5 text-sm text-ink">
                Admins have full access, including staff and settings.
              </p>
            ) : (
              <div className="flex flex-col gap-3 border-t border-concrete-150 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">Permissions</span>
                  <span className="text-sm text-ink-700 tabular-nums">
                    {permissions.length} permission{permissions.length === 1 ? '' : 's'} selected
                  </span>
                </div>

                <FormField label="Start from a preset" htmlFor="staff-preset">
                  <Select
                    id="staff-preset"
                    size="sm"
                    value={presetValue}
                    onChange={(e) => applyPreset(e.target.value)}
                    disabled={submitting}
                    placeholder="Choose a preset"
                    options={catalog.presets.map((preset) => ({ value: preset.key, label: preset.label }))}
                  />
                </FormField>

                <div className="flex flex-col gap-3">
                  {catalog.groups.map((group) => (
                    <PermissionGroupEditor
                      key={group.group}
                      group={group}
                      checked={permissions}
                      onChange={setPermissions}
                      disabled={submitting}
                    />
                  ))}
                </div>
              </div>
            )}

            <FormError message={formError} />
            <SheetFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {mode === 'create' ? 'Add staff member' : 'Save changes'}
              </Button>
            </SheetFooter>
          </SheetBody>
        </form>
      </SheetContent>
    </Sheet>
  );
}
