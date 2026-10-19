import { cn } from '@/lib/utils';
import { ICON_STROKE } from './styles';

/**
 * The "steps" glyph used for bulk prices (v2 §1.1). Not in Lucide; drawn with the same stroke so it
 * sits with Lucide icons.
 */
export function StepsIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      <path d="M3 6h6v6h6v6h6" />
    </svg>
  );
}
