/**
 * Class recipes shared by the storefront and account components (docs/ui-v2-storefront.md §0.4).
 * Keep them here so a change to the v2 finish is one edit.
 */

/** v2 "Card": white, 1 px concrete-150 border, radius 16, soft shadow. */
export const CARD_CLASS = 'rounded-xl border border-concrete-150 bg-surface shadow-card';

/** Lucide stroke width for every UI icon (v2 §1.1). */
export const ICON_STROKE = 1.75;

/** Spread onto Lucide icons: v2 stroke, hidden from assistive tech (the text next to it says it). */
export const iconProps = { strokeWidth: ICON_STROKE, 'aria-hidden': true } as const;

/**
 * Grows a 36 px control's hit area to 44 px without changing how it looks (CLAUDE.md: 44 px minimum
 * tap targets; v2 draws some small buttons at 36). The control must not clip its overflow.
 */
export const TAP_TARGET_36 = 'relative after:absolute after:inset-x-0 after:-inset-y-1';

/** Same idea for a one-line (20 px) text button. */
export const TAP_TARGET_TEXT = 'relative after:absolute after:inset-x-0 after:-inset-y-3';

/** v2 "Link button": no border or background, blueprint, 600. */
export const LINK_BUTTON_CLASS =
  'font-semibold text-blueprint underline-offset-2 hover:text-blueprint-700 hover:underline';
