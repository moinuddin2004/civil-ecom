'use client';

import { MAX_ADDRESSES, type AddressData, type AddressDTO, type ApiResponse, type DeliveryAreaDTO } from '@aricon/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { AddressCard } from './address-card';
import { AddressForm } from './address-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogCloseButton, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';
import { errorMessage } from '@/lib/api-errors';

export interface AddressesClientProps {
  initialAddresses: AddressDTO[];
  areas: DeliveryAreaDTO[];
}

/**
 * The addresses page (SPEC §9, DESIGN.md §8.10): add, edit, delete and set default through
 * `/api/account/addresses`. Every change answers with the whole list (the default can move), which
 * replaces the one on screen.
 */
export function AddressesClient({ initialAddresses, areas }: AddressesClientProps) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AddressDTO | null>(null);

  const atLimit = addresses.length >= MAX_ADDRESSES;

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(address: AddressDTO) {
    setEditing(address);
    setDialogOpen(true);
  }

  function closeDialog(open: boolean) {
    setDialogOpen(open);
    if (!open) setEditing(null);
  }

  /** Errors are left to the form, which puts them on the fields. */
  async function handleSave(data: AddressData) {
    const { data: list } = editing
      ? await apiClient<ApiResponse<AddressDTO[]>>(`/account/addresses/${editing.id}`, { method: 'PATCH', body: data })
      : await apiClient<ApiResponse<AddressDTO[]>>('/account/addresses', { method: 'POST', body: data });
    setAddresses(list);
    toast.success('Address saved');
    setDialogOpen(false);
    setEditing(null);
  }

  async function change(request: Promise<ApiResponse<AddressDTO[]>>, done: string) {
    try {
      setAddresses((await request).data);
      toast.success(done);
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't update your addresses. Please try again."));
    }
  }

  function handleDelete(id: string) {
    void change(apiClient<ApiResponse<AddressDTO[]>>(`/account/addresses/${id}`, { method: 'DELETE' }), 'Address removed');
  }

  function handleSetDefault(id: string) {
    void change(
      apiClient<ApiResponse<AddressDTO[]>>(`/account/addresses/${id}/default`, { method: 'POST' }),
      'Default address updated',
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {addresses.length === 0 ? (
        <p className="text-sm text-cement">You don&apos;t have any saved addresses yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={() => openEdit(address)}
              onDelete={() => handleDelete(address.id)}
              onSetDefault={() => handleSetDefault(address.id)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Button type="button" variant="secondary" size="md" className="self-start" onClick={openAdd} disabled={atLimit}>
          Add address
        </Button>
        {atLimit ? (
          <p className="text-sm text-cement">You&apos;ve reached the limit of {MAX_ADDRESSES} saved addresses.</p>
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent mobile="sheet" size="lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit address' : 'Add address'}</DialogTitle>
            <DialogCloseButton />
          </DialogHeader>
          <DialogBody>
            <AddressForm
              key={editing?.id ?? 'new'}
              areas={areas}
              defaultValues={editing ?? undefined}
              onSubmit={handleSave}
              onCancel={() => closeDialog(false)}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
