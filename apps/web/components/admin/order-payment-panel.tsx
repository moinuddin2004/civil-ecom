'use client';

import {
  codCollectedSchema,
  formatDateTime,
  formatFileSize,
  formatPKR,
  PAYMENT_METHOD_LABELS,
  rejectReceiptSchema,
  type AdminOrderDTO,
  type AdminReceiptDTO,
  type ApiResponse,
  type CodCollectedInput,
  type FileLinkDTO,
  type Permission,
  type RejectReceiptInput,
} from '@aricon/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ReceiptStatusBadge } from '@/components/shop/status-badges';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogCloseButton, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAdminSession } from '@/lib/admin/session';
import { apiClient } from '@/lib/api-client';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';

export interface OrderPaymentPanelProps {
  order: AdminOrderDTO;
}

/**
 * Payment panel (SPEC §6.8, §10.4): method + status, bank-transfer receipts with Approve/Reject
 * (`orders.verify_payment`, while the order isn't cancelled or returned), and the COD "Mark cash
 * collected" form (`orders.cod_collect`) once the order is dispatched/delivered and not yet paid.
 * Each action calls the admin orders API and refreshes the page with the updated order. Receipt
 * files can't be opened yet: the API has no receipt file endpoint until file storage is connected.
 */
export function OrderPaymentPanel({ order }: OrderPaymentPanelProps) {
  const { me } = useAdminSession();
  if (!me) return null;
  const can = (perm: Permission) => me.permissions.includes(perm);

  const canReview = can('orders.verify_payment') && order.status !== 'CANCELLED' && order.status !== 'RETURNED';
  const canCollectCod = can('orders.cod_collect');
  const showCodForm =
    canCollectCod &&
    order.paymentMethod === 'COD' &&
    (order.status === 'DISPATCHED' || order.status === 'DELIVERED') &&
    order.paymentStatus !== 'PAID';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-concrete-150 bg-surface p-5">
      <h2 className="type-h3">Payment</h2>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-700">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span>
        <span className="font-semibold tabular-nums text-ink">{formatPKR(order.total)}</span>
      </div>

      {order.paymentMethod === 'BANK_TRANSFER' ? (
        <div className="flex flex-col gap-2">
          {order.receipts.length > 0 ? (
            order.receipts.map((receipt) => <ReceiptRow key={receipt.id} order={order} receipt={receipt} canReview={canReview} />)
          ) : (
            <p className="text-sm text-cement">No receipt uploaded yet.</p>
          )}
        </div>
      ) : order.codCollected ? (
        <CodCollectedSummary order={order} collected={order.codCollected} />
      ) : (
        <p className="text-sm text-cement">
          {order.paymentStatus === 'PAID' ? 'Cash collected on delivery.' : 'Cash on delivery — collect from the customer.'}
        </p>
      )}

      {showCodForm ? <CodCollectedForm order={order} /> : null}
    </div>
  );
}

/** Expected vs collected for a paid COD order: the difference and the reason staff gave stay visible here. */
function CodCollectedSummary({ order, collected }: { order: AdminOrderDTO; collected: NonNullable<AdminOrderDTO['codCollected']> }) {
  const difference = collected.amount - order.total;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <dl className="flex flex-col gap-1">
        <div className="flex justify-between text-ink-700">
          <dt>Expected</dt>
          <dd className="tabular-nums">{formatPKR(order.total)}</dd>
        </div>
        <div className="flex justify-between text-ink-700">
          <dt>Collected</dt>
          <dd className="tabular-nums">{formatPKR(collected.amount)}</dd>
        </div>
        {difference !== 0 ? (
          <div className={`flex justify-between font-semibold ${difference < 0 ? 'text-danger' : 'text-success'}`}>
            <dt>{difference < 0 ? 'Short' : 'Extra'}</dt>
            <dd className="tabular-nums">{formatPKR(Math.abs(difference))}</dd>
          </div>
        ) : null}
      </dl>
      {collected.note ? <p className="rounded-md bg-concrete-50 px-3 py-2 text-ink-700">Reason: {collected.note}</p> : null}
      <p className="text-cement">
        Recorded {formatDateTime(collected.at)}
        {collected.byName ? ` by ${collected.byName}` : ''}.
      </p>
    </div>
  );
}

/**
 * Opens a receipt through a 10-minute private link (SPEC §6.8). The tab is opened on the click
 * itself (so pop-up blockers allow it) and pointed at the link once the API has made it.
 */
function ViewReceiptButton({ path }: { path: string }) {
  const [opening, setOpening] = useState(false);

  async function open() {
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    setOpening(true);
    try {
      const { data } = await apiClient<ApiResponse<FileLinkDTO>>(path);
      if (tab) tab.location.href = data.url;
      else window.location.assign(data.url);
    } catch (error) {
      tab?.close();
      toast.error(errorMessage(error, "We couldn't open the receipt. Please try again."));
    } finally {
      setOpening(false);
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" loading={opening} onClick={() => void open()}>
      View receipt
    </Button>
  );
}

function ReceiptRow({ order, receipt, canReview }: { order: AdminOrderDTO; receipt: AdminReceiptDTO; canReview: boolean }) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const form = useForm<RejectReceiptInput>({ resolver: zodResolver(rejectReceiptSchema), defaultValues: { reason: '' } });
  const receiptPath = `/admin/orders/${order.id}/receipts/${receipt.id}`;

  async function approve() {
    setApproving(true);
    try {
      await apiClient<ApiResponse<AdminOrderDTO>>(`${receiptPath}/approve`, { method: 'POST' });
      toast.success('Payment approved', { description: `${order.orderNumber} is now marked paid.` });
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setApproving(false);
    }
  }

  async function reject(values: RejectReceiptInput) {
    setRejectError(null);
    try {
      await apiClient<ApiResponse<AdminOrderDTO>>(`${receiptPath}/reject`, { method: 'POST', body: values });
      toast.success('Payment receipt rejected');
      setRejectOpen(false);
      form.reset();
      router.refresh();
    } catch (error) {
      if (!applyFieldErrors(error, form.setError)) setRejectError(errorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border border-concrete-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-ink">Receipt · {formatFileSize(receipt.sizeBytes)}</span>
          <span className="text-xs text-cement">Uploaded {formatDateTime(receipt.uploadedAt)}</span>
          {receipt.reviewedByName ? <span className="text-xs text-cement">Reviewed by {receipt.reviewedByName}</span> : null}
          {receipt.status === 'rejected' && receipt.rejectReason ? <span className="text-xs text-danger">{receipt.rejectReason}</span> : null}
        </div>
        <ReceiptStatusBadge status={receipt.status} />
      </div>
      <div className="mt-1 flex flex-wrap gap-2">
        <ViewReceiptButton path={`${receiptPath}/url`} />
        {canReview && receipt.status === 'pending' ? (
          <>
            <Button type="button" variant="secondary" size="sm" loading={approving} onClick={() => void approve()}>
              Approve
            </Button>
            <Button
              type="button"
              variant="destructive-outline"
              size="sm"
              disabled={approving}
              onClick={() => {
                setRejectError(null);
                setRejectOpen(true);
              }}
            >
              Reject…
            </Button>
          </>
        ) : null}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent mobile="sheet" size="sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Reject this receipt?</DialogTitle>
            <DialogCloseButton />
          </DialogHeader>
          <form onSubmit={form.handleSubmit(reject)}>
            <DialogBody>
              <p className="text-sm text-ink-700">The customer will be emailed this reason and asked to upload a new receipt.</p>
              <FormField label="Reason" htmlFor={`reject-reason-${receipt.id}`} error={form.formState.errors.reason?.message} required>
                <Textarea id={`reject-reason-${receipt.id}`} size="sm" rows={3} {...form.register('reason')} />
              </FormField>
              <FormError message={rejectError} />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" size="sm" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" size="sm" loading={form.formState.isSubmitting}>
                Reject receipt
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CodCollectedForm({ order }: { order: AdminOrderDTO }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<CodCollectedInput>({
    resolver: zodResolver(codCollectedSchema),
    defaultValues: { amount: order.total, note: '' },
  });

  async function submit(values: CodCollectedInput) {
    setFormError(null);
    try {
      await apiClient<ApiResponse<AdminOrderDTO>>(`/admin/orders/${order.id}/cod-collected`, { method: 'POST', body: values });
      toast.success('Cash collected recorded');
      router.refresh();
    } catch (error) {
      if (!applyFieldErrors(error, form.setError)) setFormError(errorMessage(error));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-3 border-t border-concrete-150 pt-3">
      <p className="text-sm font-medium text-ink">Mark cash collected</p>
      <FormField label="Amount collected" htmlFor="cod-amount" error={form.formState.errors.amount?.message} required>
        <Input id="cod-amount" type="number" inputMode="numeric" size="sm" min={0} {...form.register('amount', { valueAsNumber: true })} />
      </FormField>
      <FormField label="Note" htmlFor="cod-note" hint="Required if the amount differs from the order total." error={form.formState.errors.note?.message}>
        <Textarea id="cod-note" size="sm" rows={2} {...form.register('note')} />
      </FormField>
      <FormError message={formError} />
      <Button type="submit" variant="secondary" size="sm" className="self-start" loading={form.formState.isSubmitting}>
        Mark cash collected
      </Button>
    </form>
  );
}
