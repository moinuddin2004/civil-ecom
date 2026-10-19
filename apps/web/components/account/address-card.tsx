import type { AddressDTO } from '@aricon/shared';
import { DefaultBadge } from '@/components/shop/status-badges';
import { CARD_CLASS } from '@/components/shop/styles';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AddressCardProps {
  address: AddressDTO;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

/** Saved address card (SPEC §9, DESIGN.md §8.10): label, default badge, contact, full address. */
export function AddressCard({ address, onEdit, onDelete, onSetDefault }: AddressCardProps) {
  return (
    <div className={cn(CARD_CLASS, 'flex flex-col gap-2 p-4')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink">{address.label}</span>
        {address.isDefault ? <DefaultBadge /> : null}
      </div>
      <p className="text-sm text-ink-700">
        {address.contactName} · {address.phone}
      </p>
      <p className="text-sm text-ink-700">
        {address.line1}
        {address.line2 ? `, ${address.line2}` : ''}
      </p>
      {address.landmark ? <p className="text-sm text-cement">Landmark: {address.landmark}</p> : null}
      <p className="text-sm text-ink-700">
        {address.areaName ?? 'Unknown area'}, {address.city}
      </p>
      {!address.areaServiceable ? <p className="text-sm text-danger">Not delivering to this area right now.</p> : null}

      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" variant="destructive-ghost" size="sm" onClick={onDelete}>
          Delete
        </Button>
        {!address.isDefault ? (
          <Button type="button" variant="tertiary" size="sm" onClick={onSetDefault}>
            Set as default
          </Button>
        ) : null}
      </div>
    </div>
  );
}
