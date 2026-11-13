'use client';

import { formatPkPhone, type ApiResponse, type RiderCreateInput, type RiderDTO, type RiderUpdateInput } from '@aricon/shared';
import { Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/admin/access-denied';
import { RiderForm, type RiderFormValues } from '@/components/admin/rider-form';
import { Pill } from '@/components/shop/status-badges';
import { Button } from '@/components/ui/button';
import { Sheet, SheetBody, SheetCloseButton, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { apiClient } from '@/lib/api-client';
import { useAdminSession } from '@/lib/admin/session';

export interface RidersViewProps {
  riders: RiderDTO[];
}

/**
 * Riders admin page (SPEC §10.9, DESIGN.md §9.6): simple table + add/edit dialog through
 * `/api/admin/riders`. Staff who can assign riders (`orders.assign_rider`) see the list; adding
 * and editing need `riders.manage`. Riders are deactivated, never deleted (orders keep a snapshot).
 */
export function RidersView({ riders }: RidersViewProps) {
  const { me } = useAdminSession();
  const router = useRouter();
  const [editing, setEditing] = useState<RiderDTO | null | undefined>(undefined);

  if (!me) return null;
  const canManage = me.permissions.includes('riders.manage');
  if (!canManage && !me.permissions.includes('orders.assign_rider')) return <AccessDenied />;

  /** Errors are left to the form, which puts them on the fields. */
  async function handleSave(values: RiderFormValues) {
    if (editing) {
      const body: RiderUpdateInput = { name: values.name, phone: values.phone, isActive: values.isActive };
      await apiClient<ApiResponse<RiderDTO>>(`/admin/riders/${editing.id}`, { method: 'PATCH', body });
      toast.success('Rider updated');
    } else {
      const body: RiderCreateInput = { name: values.name, phone: values.phone, isActive: values.isActive };
      await apiClient<ApiResponse<RiderDTO>>('/admin/riders', { method: 'POST', body });
      toast.success('Rider added');
    }
    setEditing(undefined);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-h1">Riders</h1>
        {canManage ? (
          <Button size="sm" onClick={() => setEditing(null)}>
            <Plus aria-hidden strokeWidth={1.75} className="size-4" />
            Add rider
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-concrete-150 bg-surface shadow-card">
        <table className="w-full min-w-[500px] text-sm">
          <thead>
            <tr className="border-b border-concrete-150 text-left text-xs text-cement">
              <th className="py-2.5 pr-3 pl-4 font-medium">Name</th>
              <th className="py-2.5 pr-3 font-medium">Phone</th>
              <th className="py-2.5 pr-3 font-medium">Status</th>
              {canManage ? <th className="py-2.5 pr-4 font-medium" /> : null}
            </tr>
          </thead>
          <tbody>
            {riders.map((rider) => (
              <tr key={rider.id} className="border-b border-concrete-150 last:border-b-0 hover:bg-concrete-50">
                <td className="py-2.5 pr-3 pl-4 font-medium text-ink">{rider.name}</td>
                <td className="py-2.5 pr-3 tabular-nums text-ink-700">{formatPkPhone(rider.phone)}</td>
                <td className="py-2.5 pr-3">
                  <Pill tone={rider.isActive ? 'success' : 'neutral'} size="sm">
                    {rider.isActive ? 'Active' : 'Inactive'}
                  </Pill>
                </td>
                {canManage ? (
                  <td className="py-2.5 pr-4">
                    <Button type="button" variant="tertiary" size="sm" onClick={() => setEditing(rider)}>
                      <Pencil aria-hidden strokeWidth={1.75} className="size-3.5" />
                      Edit
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage ? (
        <Sheet open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}>
          <SheetContent size="sm" aria-describedby={undefined}>
            <SheetHeader>
              <SheetTitle>{editing ? `Edit ${editing.name}` : 'Add rider'}</SheetTitle>
              <SheetCloseButton />
            </SheetHeader>
            <SheetBody>
              {editing !== undefined ? (
                <RiderForm key={editing?.id ?? 'new'} rider={editing ?? undefined} onSubmit={handleSave} onCancel={() => setEditing(undefined)} />
              ) : null}
            </SheetBody>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}
