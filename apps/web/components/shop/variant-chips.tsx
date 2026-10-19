import { VARIANT_OPTION_LABELS, type ProductVariantDTO, type VariantOptionKey } from '@aricon/shared';
import { cn } from '@/lib/utils';

export interface VariantChipsProps {
  /** Option keys that vary between variants, in display order (`ProductDetail.optionKeys`). */
  optionKeys: VariantOptionKey[];
  variants: ProductVariantDTO[];
  selected: ProductVariantDTO;
  onSelect: (variant: ProductVariantDTO) => void;
  className?: string;
}

/** Distinct values of `key` across `variants`, in first-seen order. */
function distinctValues(variants: ProductVariantDTO[], key: VariantOptionKey): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const variant of variants) {
    const value = variant.options[key];
    if (value && !seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
  }
  return values;
}

/**
 * The variant matching `current`'s options with `key` changed to `value`. Falls back to any variant
 * with that value for `key` when the exact combination doesn't exist (fixture products mostly vary on
 * one key, so the two coincide); `null` means the combination is unavailable.
 */
function findMatch(
  variants: ProductVariantDTO[],
  optionKeys: VariantOptionKey[],
  current: ProductVariantDTO,
  key: VariantOptionKey,
  value: string,
): ProductVariantDTO | null {
  const exact = variants.find((variant) =>
    optionKeys.every((k) => (k === key ? variant.options[k] === value : variant.options[k] === current.options[k])),
  );
  if (exact) return exact;
  return variants.find((variant) => variant.options[key] === value) ?? null;
}

/**
 * Variant chip rows (DESIGN.md §6 "Variant chips", §6.3): one row per option key, chips for each
 * distinct value across variants. Selected: blueprint fill and border. Unavailable (no variant has
 * that combination): dashed border, muted text, not clickable.
 */
export function VariantChips({ optionKeys, variants, selected, onSelect, className }: VariantChipsProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {optionKeys.map((key) => {
        const values = distinctValues(variants, key);
        if (values.length === 0) return null;
        const groupLabel = VARIANT_OPTION_LABELS[key];

        return (
          <div key={key} className="flex flex-col gap-2">
            <p className="text-sm font-medium">{groupLabel}</p>
            <div role="group" aria-label={groupLabel} className="flex flex-wrap gap-2">
              {values.map((value) => {
                const match = findMatch(variants, optionKeys, selected, key, value);
                const isSelected = selected.options[key] === value;
                const isAvailable = match !== null;

                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={!isAvailable}
                    onClick={() => match && onSelect(match)}
                    className={cn(
                      'flex h-11 min-w-11 items-center justify-center rounded-md border px-4 text-sm font-medium whitespace-nowrap',
                      'transition-colors duration-150 ease-out focus-visible:-outline-offset-2',
                      isSelected && 'border-blueprint bg-blueprint-50 text-blueprint',
                      !isSelected && isAvailable && 'border-concrete-400 bg-surface text-ink hover:border-ink',
                      !isAvailable && 'border-dashed border-concrete-400 text-concrete-400',
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
