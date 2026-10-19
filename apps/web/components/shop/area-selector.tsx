'use client';

import { formatPKR, type DeliveryAreaDTO } from '@aricon/shared';
import { MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCart } from '@/lib/cart/cart-context';
import { cn } from '@/lib/utils';
import { iconProps } from './styles';

export interface AreaSelectorProps {
  areas: DeliveryAreaDTO[];
  /** Ghost on the ink header (mobile/desktop bar) vs. plain on a white surface. */
  tone?: 'onInk' | 'onSurface';
  className?: string;
}

/**
 * "Delivering to {area}" chip (SPEC §8.2, DESIGN.md §6): opens a searchable list of delivery
 * areas; unserviceable areas are shown but disabled. The choice is remembered for delivery-fee
 * estimates (checkout always uses the address's own area).
 */
export function AreaSelector({ areas, tone = 'onInk', className }: AreaSelectorProps) {
  const { areaId, setAreaId } = useCart();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = areas.find((area) => area.id === areaId) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return areas;
    return areas.filter((area) => area.name.toLowerCase().includes(q));
  }, [areas, query]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap',
            tone === 'onInk' ? 'bg-ink-700 text-white hover:bg-ink-700/80' : 'bg-concrete-100 text-ink hover:bg-concrete-150',
            className,
          )}
        >
          <MapPin {...iconProps} className="size-4 shrink-0" />
          <span className="max-w-[160px] truncate sm:max-w-[220px]">
            {selected ? `Delivering to ${selected.name}` : 'Choose delivery area'}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent mobile="sheet" size="md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Choose your delivery area</DialogTitle>
          <DialogCloseButton />
        </DialogHeader>
        <DialogBody>
          <Input
            size="lg"
            placeholder="Search area"
            aria-label="Search delivery area"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ul className="flex flex-col overflow-hidden rounded-md border border-concrete-200">
            {filtered.map((area) => (
              <li key={area.id} className="border-t border-concrete-200 first:border-t-0">
                <button
                  type="button"
                  disabled={!area.isServiceable}
                  onClick={() => {
                    setAreaId(area.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2.5 text-left',
                    area.isServiceable ? 'hover:bg-concrete-50' : 'cursor-not-allowed opacity-60',
                    area.id === areaId && 'bg-blueprint-50',
                  )}
                >
                  <span className="flex flex-col">
                    <span className="font-medium text-ink">{area.name}</span>
                    {area.isServiceable ? (
                      <span className="text-xs text-cement">
                        {formatPKR(area.deliveryFee)} delivery
                        {area.freeDeliveryAbove !== null ? ` · free above ${formatPKR(area.freeDeliveryAbove)}` : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-danger">Not delivering yet</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 ? <li className="px-4 py-6 text-sm text-ink-700">No matching area.</li> : null}
          </ul>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
