'use client';

import {
  cancelOrderSchema,
  staffTransitionsFrom,
  type AdminOrderDTO,
  type AdminOrderStatusInput,
  type ApiResponse,
  type CancelOrderInput,
  type OrderTransition,
} from '@aricon/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog, DialogBody, DialogCloseButton, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DownloadButton } from '@/components/ui/download-button';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';
import { useAdminSession } from '@/lib/admin/session';
import { apiClient } from '@/lib/api-client';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';

export interface OrderStatusActionsProps {
  order: AdminOrderDTO;
}

/** The extra §6.7 conditions `staffTransitionsFrom()` deliberately ignores, so the button can
 * explain why it's disabled instead of just being missing. */
function blockedReason(order: AdminOrderDTO, transition: OrderTransition): string | null {
  if (transition.to === 'CONFIRMED' && order.paymentMethod === 'BANK_TRANSFER' && order.paymentStatus !== 'PAID') {
    return 'Approve the bank transfer receipt before confirming this order.';
  }
  if (transition.to === 'DISPATCHED' && !order.riderId) {
    return 'Assign a rider before marking the order dispatched.';
  }
  return null;
}

const DESTRUCTIVE_TARGETS = new Set(['CANCELLED', 'RETURNED']);

/**
 * Header action buttons (SPEC §10.4, DESIGN.md §9.3): one per `staffTransitionsFrom()` result for
 * the signed-in staff member. Each confirms, then `POST /api/admin/orders/:id/status` (cancelling
 * asks for a reason first) and refreshes the page with the updated order. Print invoice stays
 * disabled until the API generates invoices.
 */
export function OrderStatusActions({ order }: OrderStatusActionsProps) {
  const { me } = useAdminSession();
  if (!me) return null;

  const transitions = staffTransitionsFrom(order.status, { role: me.user.role, permissions: me.permissions });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {transitions.map((transition) => (
        <TransitionButton key={transition.to} order={order} transition={transition} />
      ))}
      <DownloadButton path={`/admin/orders/${order.id}/invoice`} fileName={`invoice-${order.orderNumber}.pdf`} variant="secondary" size="sm">
        Download invoice
      </DownloadButton>
    </div>
  );
}

function TransitionButton({ order, transition }: { order: AdminOrderDTO; transition: OrderTransition }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const blocked = blockedReason(order, transition);
  const destructive = DESTRUCTIVE_TARGETS.has(transition.to);
  const variant: ButtonProps['variant'] = destructive ? 'destructive-outline' : 'primary';

  const form = useForm<CancelOrderInput>({ resolver: zodResolver(cancelOrderSchema), defaultValues: { reason: '' } });

  async function changeStatus(body: AdminOrderStatusInput) {
    await apiClient<ApiResponse<AdminOrderDTO>>(`/admin/orders/${order.id}/status`, { method: 'POST', body });
    toast.success(transition.doneLabel);
    router.refresh();
  }

  async function confirm() {
    setSubmitting(true);
    try {
      await changeStatus({ to: transition.to });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmWithReason(values: CancelOrderInput) {
    setFormError(null);
    try {
      await changeStatus({ to: transition.to, reason: values.reason });
      setOpen(false);
      form.reset();
    } catch (error) {
      if (!applyFieldErrors(error, form.setError)) setFormError(errorMessage(error));
    }
  }

  if (!transition.requiresReason) {
    return (
      <>
        <Button
          type="button"
          variant={variant}
          size="sm"
          disabled={Boolean(blocked)}
          loading={submitting}
          title={blocked ?? undefined}
          onClick={() => setOpen(true)}
        >
          {transition.actionLabel}
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title={`${transition.actionLabel}?`}
          description={`Order ${order.orderNumber} will be marked ${transition.to.toLowerCase()}.`}
          confirmLabel={transition.actionLabel}
          cancelLabel="Cancel"
          confirmVariant={destructive ? 'destructive' : 'primary'}
          onConfirm={() => void confirm()}
        />
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        disabled={Boolean(blocked)}
        title={blocked ?? undefined}
        onClick={() => {
          setFormError(null);
          setOpen(true);
        }}
      >
        {transition.actionLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent mobile="sheet" size="sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{transition.actionLabel}?</DialogTitle>
            <DialogCloseButton />
          </DialogHeader>
          <form onSubmit={form.handleSubmit(confirmWithReason)}>
            <DialogBody>
              <p className="text-sm text-ink-700">
                Order {order.orderNumber} will be marked {transition.to.toLowerCase()}. This can&apos;t be undone.
              </p>
              <FormField label="Reason" htmlFor="transition-reason" error={form.formState.errors.reason?.message} required>
                <Textarea id="transition-reason" size="sm" rows={3} {...form.register('reason')} />
              </FormField>
              <FormError message={formError} />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Keep order
              </Button>
              <Button type="submit" variant="destructive" size="sm" loading={form.formState.isSubmitting}>
                {transition.actionLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
