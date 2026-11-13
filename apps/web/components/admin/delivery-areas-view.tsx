'use client';

import {
  DEFAULT_CITY,
  deliveryAreaCreateSchema,
  formatPKR,
  type AdminDeliveryAreaDTO,
  type ApiResponse,
  type DeliveryAreaCreateInput,
} from '@aricon/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { AccessDenied } from '@/components/admin/access-denied';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Sheet, SheetBody, SheetCloseButton, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/lib/api-client';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';
import { useAdminSession } from '@/lib/admin/session';
import { cn } from '@/lib/utils';

export interface DeliveryAreasViewProps {
  areas: AdminDeliveryAreaDTO[];
  defaultDeliveryFee: number;
}

type AreaFormValues = z.output<typeof deliveryAreaCreateSchema>;

/** Fields the API can report errors for that the form shows; anything else is shown at the bottom. */
const ERROR_FIELDS = ['name', 'city', 'deliveryFee', 'freeDeliveryAbove', 'sortOrder'] as const;

const NEW_AREA: DeliveryAreaCreateInput = {
  name: '',
  city: DEFAULT_CITY,
  isServiceable: true,
  deliveryFee: null,
  freeDeliveryAbove: null,
  sortOrder: 0,
};

function toFormValues(area: AdminDeliveryAreaDTO): DeliveryAreaCreateInput {
  return {
    name: area.name,
    city: area.city,
    isServiceable: area.isServiceable,
    deliveryFee: area.deliveryFee,
    freeDeliveryAbove: area.freeDeliveryAbove,
    sortOrder: area.sortOrder,
  };
}

/** A blank amount is null: the store's default fee, or no free delivery. */
function blankToNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : Number(text);
}

interface AreaFormSheetProps {
  /** The area being edited; left out when adding a new one. */
  area?: AdminDeliveryAreaDTO;
  defaultDeliveryFee: number;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Add/edit one delivery area in a right-hand drawer. A blank delivery fee means the store default;
 * a blank "free delivery above" means free delivery is never offered for that area.
 */
function AreaFormSheet({ area, defaultDeliveryFee, onClose, onSaved }: AreaFormSheetProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeliveryAreaCreateInput, unknown, AreaFormValues>({
    resolver: zodResolver(deliveryAreaCreateSchema),
    defaultValues: area ? toFormValues(area) : NEW_AREA,
  });

  async function save(data: AreaFormValues) {
    setFormError(null);
    try {
      if (area) {
        const { data: saved } = await apiClient<ApiResponse<AdminDeliveryAreaDTO>>(`/admin/delivery-areas/${area.id}`, {
          method: 'PATCH',
          body: data,
        });
        toast.success(`${saved.name} saved`);
      } else {
        const { data: saved } = await apiClient<ApiResponse<AdminDeliveryAreaDTO>>('/admin/delivery-areas', { method: 'POST', body: data });
        toast.success(`${saved.name} added`);
      }
      onSaved();
    } catch (error) {
      const handled = applyFieldErrors(error, setError, { fields: ERROR_FIELDS });
      if (!handled) setFormError(errorMessage(error, "We couldn't save this area. Please try again."));
    }
  }

  return (
    <form onSubmit={handleSubmit(save)} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
        <FormField label="Name" htmlFor="area-name" error={errors.name?.message} hint="e.g. DHA Phase 6, Gulshan-e-Iqbal" required>
          <Input id="area-name" size="sm" {...register('name')} />
        </FormField>

        <FormField label="City" htmlFor="area-city" error={errors.city?.message} required>
          <Input id="area-city" size="sm" {...register('city')} />
        </FormField>

        <label htmlFor="area-serviceable" className="flex min-h-9 items-center justify-between gap-3 text-sm font-medium text-ink">
          <span className="flex flex-col">
            Serviceable
            <span className="text-xs font-normal text-cement">Off hides the area at checkout.</span>
          </span>
          <Controller
            control={control}
            name="isServiceable"
            render={({ field }) => (
              <Switch id="area-serviceable" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </label>

        <FormField
          label="Delivery fee"
          htmlFor="area-delivery-fee"
          error={errors.deliveryFee?.message}
          hint={`Leave blank to use the store default of ${formatPKR(defaultDeliveryFee)}.`}
        >
          <Input
            id="area-delivery-fee"
            size="sm"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={`Default (${formatPKR(defaultDeliveryFee)})`}
            {...register('deliveryFee', { setValueAs: blankToNull })}
          />
        </FormField>

        <FormField
          label="Free delivery above"
          htmlFor="area-free-delivery"
          error={errors.freeDeliveryAbove?.message}
          hint="Optional order total that unlocks free delivery in this area."
        >
          <Input
            id="area-free-delivery"
            size="sm"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="None"
            {...register('freeDeliveryAbove', { setValueAs: blankToNull })}
          />
        </FormField>

        <FormField label="Sort order" htmlFor="area-sort-order" error={errors.sortOrder?.message} hint="Lower numbers come first in the list.">
          <Input
            id="area-sort-order"
            size="sm"
            type="number"
            inputMode="numeric"
            {...register('sortOrder', { setValueAs: (value: unknown) => blankToNull(value) ?? 0 })}
          />
        </FormField>

        <FormError message={formError} />

        <SheetFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {area ? 'Save changes' : 'Add area'}
          </Button>
        </SheetFooter>
      </SheetBody>
    </form>
  );
}

/**
 * Delivery areas admin page (SPEC §10.9, DESIGN.md §9.6): a read-only table; add and edit open the
 * form in a drawer (`/api/admin/delivery-areas`). Areas are switched off with "Serviceable", never
 * deleted.
 */
export function DeliveryAreasView({ areas, defaultDeliveryFee }: DeliveryAreasViewProps) {
  const { me } = useAdminSession();
  const router = useRouter();
  const [editing, setEditing] = useState<AdminDeliveryAreaDTO | 'new' | undefined>(undefined);

  if (!me) return null;
  if (!me.permissions.includes('delivery_areas.manage')) return <AccessDenied />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="type-h1">Delivery areas</h1>
          <p className="text-sm text-ink-700">Areas with a blank delivery fee use the store default of {formatPKR(defaultDeliveryFee)}.</p>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus aria-hidden strokeWidth={1.75} className="size-4" />
          Add area
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-concrete-150 bg-surface shadow-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-concrete-150 text-left text-xs text-cement">
              <th className="py-2.5 pr-3 pl-4 font-medium">Name</th>
              <th className="py-2.5 pr-3 font-medium">City</th>
              <th className="py-2.5 pr-3 font-medium">Serviceable</th>
              <th className="py-2.5 pr-3 font-medium">Delivery fee</th>
              <th className="py-2.5 pr-3 font-medium">Free delivery above</th>
              <th className="py-2.5 pr-3 font-medium">Sort order</th>
              <th className="py-2.5 pr-4 font-medium" />
            </tr>
          </thead>
          <tbody>
            {areas.map((area) => (
              <tr key={area.id} className="border-b border-concrete-150 transition-colors last:border-b-0 hover:bg-concrete-50/60">
                <td className="py-2.5 pr-3 pl-4 font-medium text-ink">{area.name}</td>
                <td className="py-2.5 pr-3 text-ink-700">{area.city}</td>
                <td className="py-2.5 pr-3">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      area.isServiceable ? 'bg-success-50 text-success' : 'bg-concrete-50 text-cement',
                    )}
                  >
                    {area.isServiceable ? 'Serviceable' : 'Off'}
                  </span>
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-ink">
                  {area.deliveryFee === null ? (
                    <span className="text-cement">Default ({formatPKR(defaultDeliveryFee)})</span>
                  ) : (
                    formatPKR(area.deliveryFee)
                  )}
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-ink">
                  {area.freeDeliveryAbove === null ? <span className="text-cement">—</span> : formatPKR(area.freeDeliveryAbove)}
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-ink-700">{area.sortOrder}</td>
                <td className="py-2.5 pr-4">
                  <Button type="button" variant="tertiary" size="sm" onClick={() => setEditing(area)} aria-label={`Edit ${area.name}`}>
                    <Pencil aria-hidden strokeWidth={1.75} className="size-4" />
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
            {areas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center">
                  <p className="font-medium text-ink">No delivery areas yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-ink-700">
                    Add the areas you deliver to — customers pick one from their address at checkout.
                  </p>
                  <Button size="sm" variant="secondary" className="mt-4" onClick={() => setEditing('new')}>
                    <Plus aria-hidden strokeWidth={1.75} className="size-4" />
                    Add your first area
                  </Button>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Sheet open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}>
        <SheetContent size="md" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>{editing === 'new' ? 'Add area' : editing ? `Edit ${editing.name}` : 'Delivery area'}</SheetTitle>
            <SheetCloseButton />
          </SheetHeader>
          {editing !== undefined ? (
            <AreaFormSheet
              key={editing === 'new' ? 'new' : editing.id}
              area={editing === 'new' ? undefined : editing}
              defaultDeliveryFee={defaultDeliveryFee}
              onClose={() => setEditing(undefined)}
              onSaved={() => {
                setEditing(undefined);
                router.refresh();
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
