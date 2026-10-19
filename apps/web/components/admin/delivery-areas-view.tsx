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
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useRef, useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { AccessDenied } from '@/components/admin/access-denied';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/lib/api-client';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';
import { useAdminSession } from '@/lib/admin/session';

export interface DeliveryAreasViewProps {
  areas: AdminDeliveryAreaDTO[];
  defaultDeliveryFee: number;
}

type AreaFormValues = z.output<typeof deliveryAreaCreateSchema>;
type AreaField = keyof DeliveryAreaCreateInput;

/** Fields the API can report errors for that a row shows; anything else is shown in a toast. */
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

function CellError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 max-w-40 text-xs text-danger">
      {message}
    </p>
  );
}

interface AreaRowProps {
  /** A saved area; left out for a new row that isn't saved yet. */
  area?: AdminDeliveryAreaDTO;
  defaultDeliveryFee: number;
  /** Called after the API saved the row. */
  onSaved: () => void;
  /** Drops a new row that isn't saved yet. */
  onDiscard?: () => void;
}

/**
 * One editable row with its own form (`PATCH /api/admin/delivery-areas/:id`, or `POST` for a new
 * row). The inputs sit in other cells, so they join the row's `<form>` through the `form` attribute
 * (Enter saves the row). `values` follows the API's list after `router.refresh()`; rows whose data
 * didn't change keep their unsaved edits.
 */
function AreaRow({ area, defaultDeliveryFee, onSaved, onDiscard }: AreaRowProps) {
  const formId = useId();
  const [created, setCreated] = useState(false);
  const values = useMemo(() => (area ? toFormValues(area) : undefined), [area]);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DeliveryAreaCreateInput, unknown, AreaFormValues>({
    resolver: zodResolver(deliveryAreaCreateSchema),
    defaultValues: NEW_AREA,
    values,
  });
  const isServiceable = useWatch({ control, name: 'isServiceable' });
  const label = area?.name ?? 'New area';

  const errorId = (field: AreaField) => `${formId}-${field}-error`;
  const invalid = (field: AreaField) => (errors[field] ? { 'aria-invalid': true, 'aria-describedby': errorId(field) } : {});

  async function save(data: AreaFormValues) {
    try {
      if (area) {
        const { data: saved } = await apiClient<ApiResponse<AdminDeliveryAreaDTO>>(`/admin/delivery-areas/${area.id}`, {
          method: 'PATCH',
          body: data,
        });
        reset(toFormValues(saved));
        toast.success(`${saved.name} saved`);
      } else {
        const { data: saved } = await apiClient<ApiResponse<AdminDeliveryAreaDTO>>('/admin/delivery-areas', { method: 'POST', body: data });
        setCreated(true);
        toast.success(`${saved.name} added`);
      }
      onSaved();
    } catch (error) {
      if (!applyFieldErrors(error, setError, { fields: ERROR_FIELDS })) {
        toast.error(errorMessage(error, "We couldn't save this area. Please try again."));
      }
    }
  }

  return (
    <tr className="border-b border-concrete-150 align-top last:border-b-0">
      <td className="py-2 pr-3 pl-4">
        <Input size="sm" className="w-40" form={formId} aria-label={`${label} name`} {...invalid('name')} {...register('name')} />
        <CellError id={errorId('name')} message={errors.name?.message} />
      </td>
      <td className="py-2 pr-3">
        <Input size="sm" className="w-28" form={formId} aria-label={`${label} city`} {...invalid('city')} {...register('city')} />
        <CellError id={errorId('city')} message={errors.city?.message} />
      </td>
      <td className="py-2 pr-3">
        <div className="flex h-9 items-center">
          <Switch
            checked={isServiceable}
            onCheckedChange={(checked) => setValue('isServiceable', checked, { shouldDirty: true })}
            aria-label={`${label} serviceable`}
          />
        </div>
      </td>
      <td className="py-2 pr-3">
        <Input
          size="sm"
          type="number"
          inputMode="numeric"
          min={0}
          className="w-28 tabular-nums"
          form={formId}
          aria-label={`${label} delivery fee`}
          placeholder={`Default (${formatPKR(defaultDeliveryFee)})`}
          {...invalid('deliveryFee')}
          {...register('deliveryFee', { setValueAs: blankToNull })}
        />
        <CellError id={errorId('deliveryFee')} message={errors.deliveryFee?.message} />
      </td>
      <td className="py-2 pr-3">
        <Input
          size="sm"
          type="number"
          inputMode="numeric"
          min={0}
          className="w-32 tabular-nums"
          form={formId}
          aria-label={`${label} free delivery above`}
          placeholder="None"
          {...invalid('freeDeliveryAbove')}
          {...register('freeDeliveryAbove', { setValueAs: blankToNull })}
        />
        <CellError id={errorId('freeDeliveryAbove')} message={errors.freeDeliveryAbove?.message} />
      </td>
      <td className="py-2 pr-3">
        <Input
          size="sm"
          type="number"
          className="w-20 tabular-nums"
          form={formId}
          aria-label={`${label} sort order`}
          {...invalid('sortOrder')}
          {...register('sortOrder', { setValueAs: (value: unknown) => blankToNull(value) ?? 0 })}
        />
        <CellError id={errorId('sortOrder')} message={errors.sortOrder?.message} />
      </td>
      <td className="py-2 pr-4">
        <form id={formId} onSubmit={handleSubmit(save)} noValidate className="flex items-center gap-1">
          <Button type="submit" variant="secondary" size="sm" loading={isSubmitting || created}>
            Save
          </Button>
          {onDiscard ? (
            <Button type="button" variant="ghost" size="sm" onClick={onDiscard} disabled={isSubmitting || created}>
              Discard
            </Button>
          ) : null}
        </form>
      </td>
    </tr>
  );
}

/**
 * Delivery areas admin page (SPEC §10.9, DESIGN.md §9.6): an inline-editable table through
 * `/api/admin/delivery-areas`, one form per row. Areas are switched off with "Serviceable", never
 * deleted.
 */
export function DeliveryAreasView({ areas, defaultDeliveryFee }: DeliveryAreasViewProps) {
  const { me } = useAdminSession();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [newRows, setNewRows] = useState<number[]>([]);
  const nextRow = useRef(0);

  if (!me) return null;
  if (!me.permissions.includes('delivery_areas.manage')) return <AccessDenied />;

  function addRow() {
    nextRow.current += 1;
    const row = nextRow.current;
    setNewRows((prev) => [...prev, row]);
  }

  function discardRow(row: number) {
    setNewRows((prev) => prev.filter((r) => r !== row));
  }

  /** Swaps the new row for the saved one in the same render as the refreshed list. */
  function handleCreated(row: number) {
    startTransition(() => {
      discardRow(row);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="type-h1">Delivery areas</h1>
          <p className="text-sm text-ink-700">Areas with a blank delivery fee use the store default of {formatPKR(defaultDeliveryFee)}.</p>
        </div>
        <Button size="sm" onClick={addRow}>
          <Plus aria-hidden strokeWidth={1.75} className="size-4" />
          Add area
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-concrete-150 bg-surface shadow-card">
        <table className="w-full min-w-[900px] text-sm">
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
              <AreaRow key={area.id} area={area} defaultDeliveryFee={defaultDeliveryFee} onSaved={() => router.refresh()} />
            ))}
            {newRows.map((row) => (
              <AreaRow
                key={`new-${row}`}
                defaultDeliveryFee={defaultDeliveryFee}
                onSaved={() => handleCreated(row)}
                onDiscard={() => discardRow(row)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
