'use client';

import { cancelOrderSchema, type ApiResponse, type CancelOrderInput, type CustomerOrderDTO, type ReorderResultDTO } from '@aricon/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DownloadButton } from '@/components/ui/download-button';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api-client';
import { applyFieldErrors, errorMessage } from '@/lib/api-errors';
import { cartQueryKeys } from '@/lib/cart/keys';
import { routes } from '@/lib/routes';

export interface OrderActionsBarProps {
  order: CustomerOrderDTO;
}

/**
 * Order detail actions (SPEC §9):
 * - **Cancel** (only while the API says it's allowed): asks for a reason, `POST …/cancel`, then
 *   the page is refreshed with the cancelled order (stock goes back on the API side).
 * - **Reorder**: `POST …/reorder` puts what can still be bought in the cart and says what was
 *   skipped and why.
 * - **Download invoice**: the order's PDF invoice.
 */
export function OrderActionsBar({ order }: OrderActionsBarProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const orderPath = `/orders/${encodeURIComponent(order.orderNumber)}`;

  const form = useForm<CancelOrderInput>({
    resolver: zodResolver(cancelOrderSchema),
    defaultValues: { reason: '' },
  });

  async function handleCancel(values: CancelOrderInput) {
    setCancelError(null);
    try {
      await apiClient(`${orderPath}/cancel`, { method: 'POST', body: values });
      toast.success('Order cancelled');
      setCancelOpen(false);
      form.reset();
      router.refresh();
    } catch (error) {
      if (!applyFieldErrors(error, form.setError)) setCancelError(errorMessage(error));
    }
  }

  async function handleReorder() {
    setReordering(true);
    try {
      const { data } = await apiClient<ApiResponse<ReorderResultDTO>>(`${orderPath}/reorder`, { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: cartQueryKeys.all });
      const added = data.cart.lines.length;
      if (data.skipped.length === 0) {
        toast.success('Added to your cart', { action: { label: 'View cart', onClick: () => router.push(routes.cart) } });
      } else {
        toast.warning(
          added > 0 ? 'Some items were added to your cart' : "These items can't be ordered right now",
          { description: data.skipped.map((item) => `${item.productName} (${item.variantLabel}): ${item.reason}`).join(' ') },
        );
      }
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't add these items to your cart. Please try again."));
    } finally {
      setReordering(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" size="md" loading={reordering} onClick={() => void handleReorder()}>
        Reorder
      </Button>
      <DownloadButton path={`${orderPath}/invoice`} fileName={`invoice-${order.orderNumber}.pdf`} variant="secondary" size="md">
        Download invoice
      </DownloadButton>
      {order.canCancel ? (
        <Button type="button" variant="destructive-ghost" size="md" onClick={() => setCancelOpen(true)}>
          Cancel order
        </Button>
      ) : null}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent mobile="sheet" size="sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Cancel order {order.orderNumber}?</DialogTitle>
            <DialogCloseButton />
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleCancel)}>
            <DialogBody>
              <p className="text-sm text-ink-700">This can&apos;t be undone. Tell us why you&apos;re cancelling.</p>
              <FormField label="Reason" htmlFor="cancel-reason" error={form.formState.errors.reason?.message} required>
                <Textarea id="cancel-reason" rows={3} {...form.register('reason')} />
              </FormField>
              <FormError message={cancelError} />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setCancelOpen(false)}>
                Keep order
              </Button>
              <Button type="submit" variant="destructive" loading={form.formState.isSubmitting}>
                Cancel order
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
