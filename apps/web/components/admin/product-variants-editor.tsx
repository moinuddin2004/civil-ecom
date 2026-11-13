'use client';

import {
  formatPKR,
  validateVariantPricing,
  VARIANT_OPTION_KEYS,
  VARIANT_OPTION_LABELS,
  type AdminProductDTO,
  type ApiResponse,
  type PricingIssue,
} from '@aricon/shared';
import { ChevronDown, Lock, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetBody, SheetCloseButton, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { errorMessage, fieldErrors } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import { NEW_VARIANT, type ProductFormData, type ProductFormInput } from '@/lib/admin/product-form-schema';

const LOCK_TITLE = "You don't have permission to change prices.";
const STOCK_LOCK_TITLE = "You don't have permission to set stock.";

type ProductForm = UseFormReturn<ProductFormInput, unknown, ProductFormData>;

function pricingIssueMap(variant: { mrp: number; price: number; bulkTiers: { minQty: number; price: number }[] }): Map<string, string> {
  const issues: PricingIssue[] = validateVariantPricing({
    mrp: Number(variant.mrp) || 0,
    price: Number(variant.price) || 0,
    bulkTiers: (variant.bulkTiers ?? []).map((t) => ({ minQty: Number(t.minQty) || 0, price: Number(t.price) || 0 })),
  });
  const map = new Map<string, string>();
  for (const issue of issues) map.set(issue.path.join('.'), issue.message);
  return map;
}

/** A locked, read-only field: the value plus a lock icon with a native tooltip (SPEC §10.5). */
function LockedValue({ value, title = LOCK_TITLE }: { value: string; title?: string }) {
  return (
    <span title={title} className="flex h-8 items-center gap-1.5 rounded-md border border-concrete-150 bg-concrete-50 px-2 text-sm text-ink-700">
      {value}
      <Lock aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0 text-cement" />
    </span>
  );
}

export interface ProductVariantsEditorProps {
  form: ProductForm;
  /** The saved product, when editing; stock adjustments go straight to the API for it. */
  productId?: string;
  /** Viewer can't edit details: everything is disabled except "Adjust stock". */
  readOnly: boolean;
  canEditPrice: boolean;
  canEditStock: boolean;
  canAddVariant: boolean;
}

/**
 * Variants table (SPEC §10.5 "Variants"): label, options, SKU, MRP, price, stock, low-stock
 * threshold, active. Each row expands to a bulk-tier editor that runs `validateVariantPricing()`
 * live (packages/shared/src/pricing.ts) and shows its messages next to the relevant field. Price
 * fields are locked (icon + tooltip) without `products.edit_price`.
 *
 * Stock (SPEC §6.10): a saved variant's stock only changes through "Adjust stock", which records a
 * stock movement right away (`POST …/stock-adjustments`, `products.edit_stock`); a new row takes an
 * opening stock that is saved with it. Saved variants can't be deleted — untick "Active" instead.
 */
export function ProductVariantsEditor({ form, productId, readOnly, canEditPrice, canEditStock, canAddVariant }: ProductVariantsEditorProps) {
  const { control, formState } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [adjusting, setAdjusting] = useState<number | null>(null);
  const adjustingVariant = adjusting === null ? undefined : form.getValues(`variants.${adjusting}`);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-concrete-150 bg-surface shadow-card">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-concrete-150 text-left text-xs text-cement">
              <th className="w-8 py-2 pl-3" />
              <th className="py-2 pr-3 font-medium">Label</th>
              {VARIANT_OPTION_KEYS.map((key) => (
                <th key={key} className="py-2 pr-3 font-medium">{VARIANT_OPTION_LABELS[key]}</th>
              ))}
              <th className="py-2 pr-3 font-medium">SKU</th>
              <th className="py-2 pr-3 font-medium">MRP</th>
              <th className="py-2 pr-3 font-medium">Price</th>
              <th className="py-2 pr-3 font-medium">Stock</th>
              <th className="py-2 pr-3 font-medium">Low stock at</th>
              <th className="py-2 pr-3 font-medium">Active</th>
              <th className="w-8 py-2 pr-3" />
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const isOpen = Boolean(expanded[field.id]);
              const rowErrors = formState.errors.variants?.[index];
              const saved = Boolean(form.getValues(`variants.${index}.id`));
              return (
                <VariantRow
                  key={field.id}
                  form={form}
                  index={index}
                  readOnly={readOnly}
                  canEditPrice={canEditPrice}
                  canEditStock={canEditStock}
                  canAdjustStock={canEditStock && Boolean(productId)}
                  isOpen={isOpen}
                  onToggle={() => setExpanded((prev) => ({ ...prev, [field.id]: !prev[field.id] }))}
                  onRemove={fields.length > 1 && !saved && !readOnly ? () => remove(index) : undefined}
                  onAdjustStock={() => setAdjusting(index)}
                  skuError={rowErrors?.sku?.message}
                  labelError={rowErrors?.label?.message}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {canAddVariant ? (
        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => append({ ...NEW_VARIANT })}>
          <Plus aria-hidden strokeWidth={1.75} className="size-4" />
          Add variant
        </Button>
      ) : null}

      {adjusting !== null && productId && adjustingVariant?.id ? (
        <StockAdjustDialog
          productId={productId}
          variantId={adjustingVariant.id}
          variantLabel={adjustingVariant.label}
          currentStock={Number(adjustingVariant.stock) || 0}
          onClose={() => setAdjusting(null)}
          onSaved={(newStock) => {
            // Already saved by the API: show it (setValue notifies the row's watcher), and make it
            // the field's default so it doesn't count as an unsaved change.
            form.setValue(`variants.${adjusting}.stock`, newStock);
            form.resetField(`variants.${adjusting}.stock`, { defaultValue: newStock });
            setAdjusting(null);
          }}
        />
      ) : null}
    </div>
  );
}

interface VariantRowProps {
  form: ProductForm;
  index: number;
  readOnly: boolean;
  canEditPrice: boolean;
  canEditStock: boolean;
  canAdjustStock: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  onAdjustStock: () => void;
  skuError?: string;
  labelError?: string;
}

function VariantRow({
  form,
  index,
  readOnly,
  canEditPrice,
  canEditStock,
  canAdjustStock,
  isOpen,
  onToggle,
  onRemove,
  onAdjustStock,
  skuError,
  labelError,
}: VariantRowProps) {
  const { control, register } = form;
  const variant = useWatch({ control, name: `variants.${index}` });
  const issues = useMemo(
    () => pricingIssueMap({ mrp: variant?.mrp ?? 0, price: variant?.price ?? 0, bulkTiers: variant?.bulkTiers ?? [] }),
    [variant],
  );
  const isLowStock = (variant?.stock ?? 0) > 0 && (variant?.stock ?? 0) <= (variant?.lowStockThreshold ?? 5);

  return (
    <>
      <tr className={cn('border-b border-concrete-150 align-top', !isOpen && 'last:border-b-0')}>
        <td className="py-2 pl-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Collapse bulk tiers' : 'Expand bulk tiers'}
            className="flex size-6 items-center justify-center rounded text-ink-700 hover:bg-concrete-50"
          >
            <ChevronDown aria-hidden strokeWidth={1.75} className={cn('size-4 transition-transform', isOpen && 'rotate-180')} />
          </button>
        </td>
        <td className="py-2 pr-3">
          <Input size="xs" className="w-36" placeholder="e.g. 50 kg bag" aria-label="Variant label" {...register(`variants.${index}.label`)} disabled={readOnly} aria-invalid={Boolean(labelError)} />
          {labelError ? <p className="mt-1 text-xs text-danger">{labelError}</p> : null}
        </td>
        {VARIANT_OPTION_KEYS.map((key) => (
          <td key={key} className="py-2 pr-3">
            <Input size="xs" className="w-24" aria-label={VARIANT_OPTION_LABELS[key]} {...register(`variants.${index}.options.${key}`)} disabled={readOnly} />
          </td>
        ))}
        <td className="py-2 pr-3">
          <Input size="xs" className="w-32 uppercase" aria-label="SKU" {...register(`variants.${index}.sku`)} disabled={readOnly} aria-invalid={Boolean(skuError)} />
          {skuError ? <p className="mt-1 text-xs text-danger">{skuError}</p> : null}
        </td>
        <td className="py-2 pr-3">
          {canEditPrice ? (
            <>
              <Input size="xs" className="w-24 tabular-nums" type="number" aria-label="MRP" {...register(`variants.${index}.mrp`, { valueAsNumber: true })} disabled={readOnly} aria-invalid={issues.has('mrp')} />
              {issues.has('mrp') ? <p className="mt-1 text-xs text-danger">{issues.get('mrp')}</p> : null}
            </>
          ) : (
            <LockedValue value={formatPKR(Number(variant?.mrp) || 0)} />
          )}
        </td>
        <td className="py-2 pr-3">
          {canEditPrice ? (
            <>
              <Input size="xs" className="w-24 tabular-nums" type="number" aria-label="Price" {...register(`variants.${index}.price`, { valueAsNumber: true })} disabled={readOnly} aria-invalid={issues.has('price')} />
              {issues.has('price') ? <p className="mt-1 text-xs text-danger">{issues.get('price')}</p> : null}
            </>
          ) : (
            <LockedValue value={formatPKR(Number(variant?.price) || 0)} />
          )}
        </td>
        <td className="py-2 pr-3">
          {variant?.id ? (
            <div className="flex items-center gap-2">
              <span className={cn('tabular-nums', isLowStock && 'font-semibold text-danger')}>{variant.stock ?? 0}</span>
              {canAdjustStock ? (
                <Button type="button" variant="tertiary" size="sm" className="h-auto p-0 text-xs" onClick={onAdjustStock}>
                  Adjust
                </Button>
              ) : null}
            </div>
          ) : canEditStock ? (
            <Input
              size="xs"
              className="w-20 tabular-nums"
              type="number"
              min={0}
              aria-label="Opening stock"
              {...register(`variants.${index}.stock`, { valueAsNumber: true })}
              disabled={readOnly}
            />
          ) : (
            <LockedValue value="0" title={STOCK_LOCK_TITLE} />
          )}
        </td>
        <td className="py-2 pr-3">
          <Input size="xs" className="w-20 tabular-nums" type="number" aria-label="Low stock at" {...register(`variants.${index}.lowStockThreshold`, { valueAsNumber: true })} disabled={readOnly} />
        </td>
        <td className="py-2 pr-3">
          <Checkbox
            size="sm"
            checked={Boolean(variant?.isActive)}
            disabled={readOnly}
            onCheckedChange={(checked) => form.setValue(`variants.${index}.isActive`, checked === true, { shouldDirty: true })}
            aria-label="Variant active"
          />
        </td>
        <td className="py-2 pr-3">
          {onRemove ? (
            <Button type="button" variant="destructive-ghost" size="icon-sm" onClick={onRemove} aria-label="Remove variant">
              <Trash2 aria-hidden strokeWidth={1.75} className="size-4" />
            </Button>
          ) : null}
        </td>
      </tr>
      {isOpen ? (
        <tr className="border-b border-concrete-150 bg-concrete-50 last:border-b-0">
          <td />
          <td colSpan={VARIANT_OPTION_KEYS.length + 8} className="py-3 pr-4">
            <BulkTierEditor form={form} index={index} canEditPrice={canEditPrice && !readOnly} issues={issues} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function BulkTierEditor({
  form,
  index,
  canEditPrice,
  issues,
}: {
  form: ProductForm;
  index: number;
  canEditPrice: boolean;
  issues: Map<string, string>;
}) {
  const { control, register } = form;
  const { fields, append, remove } = useFieldArray({ control, name: `variants.${index}.bulkTiers` });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold tracking-wide text-ink-700 uppercase">Bulk tiers</p>
      {fields.length === 0 ? <p className="text-sm text-cement">No bulk tiers — same price at any quantity.</p> : null}
      {fields.map((field, tierIndex) => {
        const minQtyError = issues.get(`bulkTiers.${tierIndex}.minQty`);
        const priceError = issues.get(`bulkTiers.${tierIndex}.price`);
        return (
          <div key={field.id} className="flex flex-wrap items-start gap-3">
            <FormField label="Min quantity" htmlFor={`tier-${index}-${tierIndex}-min`} error={minQtyError} className="w-36">
              <Input
                id={`tier-${index}-${tierIndex}-min`}
                size="xs"
                type="number"
                disabled={!canEditPrice}
                {...register(`variants.${index}.bulkTiers.${tierIndex}.minQty`, { valueAsNumber: true })}
              />
            </FormField>
            <FormField label="Tier price" htmlFor={`tier-${index}-${tierIndex}-price`} error={priceError} className="w-36">
              {canEditPrice ? (
                <Input id={`tier-${index}-${tierIndex}-price`} size="xs" type="number" {...register(`variants.${index}.bulkTiers.${tierIndex}.price`, { valueAsNumber: true })} />
              ) : (
                <LockedValue value={formatPKR(Number(form.getValues(`variants.${index}.bulkTiers.${tierIndex}.price`)) || 0)} />
              )}
            </FormField>
            {canEditPrice ? (
              <Button type="button" variant="destructive-ghost" size="icon-sm" className="mt-6" onClick={() => remove(tierIndex)} aria-label="Remove tier">
                <Trash2 aria-hidden strokeWidth={1.75} className="size-4" />
              </Button>
            ) : null}
          </div>
        );
      })}
      {issues.get('bulkTiers') ? <p className="text-xs text-danger">{issues.get('bulkTiers')}</p> : null}
      {canEditPrice && fields.length < 5 ? (
        <Button type="button" variant="tertiary" size="sm" className="self-start px-0" onClick={() => append({ minQty: 0, price: 0 })}>
          <Plus aria-hidden strokeWidth={1.75} className="size-4" />
          Add tier
        </Button>
      ) : null}
    </div>
  );
}

interface StockAdjustDialogProps {
  productId: string;
  variantId: string;
  variantLabel: string;
  currentStock: number;
  onClose: () => void;
  onSaved: (newStock: number) => void;
}

/** "Adjust stock" for a saved variant: a signed change and a reason, recorded as a stock movement. */
function StockAdjustDialog({ productId, variantId, variantLabel, currentStock, onClose, onSaved }: StockAdjustDialogProps) {
  const router = useRouter();
  const [change, setChange] = useState(0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextStock = currentStock + change;
  const valid = Number.isInteger(change) && change !== 0 && nextStock >= 0 && reason.trim().length >= 3;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { data } = await apiClient<ApiResponse<AdminProductDTO>>(`/admin/products/${productId}/stock-adjustments`, {
        method: 'POST',
        body: { variantId, change, reason: reason.trim() },
      });
      const saved = data.variants.find((variant) => variant.id === variantId)?.stock ?? nextStock;
      toast.success('Stock adjusted');
      onSaved(saved);
      router.refresh();
    } catch (caught) {
      setError(fieldErrors(caught)[0]?.message ?? errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && !saving && onClose()}>
      <SheetContent size="sm" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Adjust stock · {variantLabel}</SheetTitle>
          <SheetCloseButton />
        </SheetHeader>
        <SheetBody>
          <p className="text-sm text-ink-700">
            Current stock: <span className="font-semibold text-ink tabular-nums">{currentStock}</span>
          </p>
          <FormField label="Change" htmlFor="stock-adjust-change" hint="Use a negative number to remove stock.">
            <Input
              id="stock-adjust-change"
              type="number"
              step={1}
              size="sm"
              value={change}
              onChange={(e) => setChange(Math.trunc(Number(e.target.value)) || 0)}
            />
          </FormField>
          <FormField label="Reason" htmlFor="stock-adjust-reason" required hint="e.g. Stock count correction, damaged goods">
            <Input id="stock-adjust-reason" size="sm" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          {nextStock < 0 ? (
            <p className="text-sm text-danger">Stock can&apos;t go below 0.</p>
          ) : (
            <p className="text-sm text-ink-700">
              New stock will be: <span className="font-semibold text-ink tabular-nums">{nextStock}</span>
            </p>
          )}
          <FormError message={error} />
          <SheetFooter>
            <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" loading={saving} disabled={!valid} onClick={() => void save()}>
              Save adjustment
            </Button>
          </SheetFooter>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
