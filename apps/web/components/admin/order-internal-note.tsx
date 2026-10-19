'use client';

import { internalNoteSchema, type AdminOrderDTO, type ApiResponse, type InternalNoteInput } from '@aricon/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Textarea } from '@/components/ui/textarea';
import { useAdminSession } from '@/lib/admin/session';
import { apiClient } from '@/lib/api-client';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';

export interface OrderInternalNoteProps {
  order: AdminOrderDTO;
}

/**
 * Internal note (SPEC §10.4), gated on `orders.update_status`: `PATCH /api/admin/orders/:id/internal-note`.
 * Saving an empty note clears it.
 */
export function OrderInternalNote({ order }: OrderInternalNoteProps) {
  const { me } = useAdminSession();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<InternalNoteInput>({
    resolver: zodResolver(internalNoteSchema),
    defaultValues: { internalNote: order.internalNote ?? '' },
  });
  if (!me || !me.permissions.includes('orders.update_status')) return null;

  async function save(values: InternalNoteInput) {
    setFormError(null);
    try {
      const { data } = await apiClient<ApiResponse<AdminOrderDTO>>(`/admin/orders/${order.id}/internal-note`, {
        method: 'PATCH',
        body: values,
      });
      form.reset({ internalNote: data.internalNote ?? '' });
      toast.success(data.internalNote ? 'Note saved' : 'Note cleared');
      router.refresh();
    } catch (error) {
      if (!applyFieldErrors(error, form.setError)) setFormError(errorMessage(error));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(save)} className="flex flex-col gap-3 rounded-xl border border-concrete-150 bg-surface p-5">
      <h2 className="type-h3">Internal note</h2>
      <p className="text-sm text-cement">Visible to staff only, never to the customer.</p>
      <Textarea
        id="order-internal-note"
        aria-label="Internal note"
        aria-invalid={form.formState.errors.internalNote ? true : undefined}
        size="sm"
        rows={4}
        placeholder="Add a note for other staff…"
        {...form.register('internalNote')}
      />
      <FormError message={form.formState.errors.internalNote?.message ?? formError} />
      <Button type="submit" variant="secondary" size="sm" className="self-start" loading={form.formState.isSubmitting}>
        Save note
      </Button>
    </form>
  );
}
