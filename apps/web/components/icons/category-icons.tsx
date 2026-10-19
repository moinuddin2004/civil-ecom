import { cn } from '@/lib/utils';

/**
 * Custom category icon set, technical-drawing line style (DESIGN.md §4.4): single weight, square
 * line caps, drawn like symbols on an engineering drawing. Used for category tiles, the mega menu
 * and drawer, and as the product-image placeholder when a product has no photo yet.
 */
export type CategoryIconName =
  | 'bag'
  | 'tile-grid'
  | 'ply-sheets'
  | 'paint-tin'
  | 'water-shield'
  | 'tank'
  | 'wire-coil'
  | 'switch-plate'
  | 'breaker'
  | 'conduit-bend'
  | 'bulb'
  | 'fan'
  | 'pipe-elbow'
  | 'tap'
  | 'hinge'
  | 'padlock'
  | 'bolt'
  | 'hard-hat'
  | 'drill';

interface IconRule {
  test: RegExp;
  icon: CategoryIconName;
}

/** Matched in order against a lowercased category slug/name (or product name as a last resort). */
const RULES: IconRule[] = [
  { test: /cement|plaster|concrete|\bopc\b|\bppc\b|\bsrc\b|mortar/, icon: 'bag' },
  { test: /tile|adhesive|grout/, icon: 'tile-grid' },
  { test: /ply|board|mdf|particle|veneer/, icon: 'ply-sheets' },
  { test: /paint|primer|emulsion|enamel|distemper|varnish/, icon: 'paint-tin' },
  { test: /waterproof|membrane/, icon: 'water-shield' },
  { test: /tank/, icon: 'tank' },
  { test: /wire|cable|\bcoil\b/, icon: 'wire-coil' },
  { test: /switch|socket|dimmer/, icon: 'switch-plate' },
  { test: /breaker|\bmcb\b|\brccb\b|distribution/, icon: 'breaker' },
  { test: /conduit|trunking/, icon: 'conduit-bend' },
  { test: /light|bulb|led|lamp/, icon: 'bulb' },
  { test: /\bfans?\b/, icon: 'fan' },
  { test: /pipe|\bppr\b|\bpprc\b|\bupvc\b|\bgi\b/, icon: 'pipe-elbow' },
  { test: /tap|shower|faucet|sanitary/, icon: 'tap' },
  { test: /hinge|handle/, icon: 'hinge' },
  { test: /lock/, icon: 'padlock' },
  { test: /fastener|bolt|screw|nail|\bnut\b/, icon: 'bolt' },
  { test: /safety|helmet|glove|\bgear\b/, icon: 'hard-hat' },
  { test: /drill|grinder|cutter|power tool/, icon: 'drill' },
];

/** Picks an icon for a category (slug or name) or, for a product placeholder, the product name. */
export function categoryIconFor(hint: string): CategoryIconName {
  const text = hint.toLowerCase();
  for (const rule of RULES) {
    if (rule.test.test(text)) return rule.icon;
  }
  return 'bag';
}

const PATHS: Record<CategoryIconName, React.ReactNode> = {
  bag: (
    <>
      <path d="M7 8h10l1.4 12.1a1 1 0 0 1-1 1.1H6.6a1 1 0 0 1-1-1.1L7 8Z" />
      <path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2" />
      <path d="M6.8 13h10.4" />
    </>
  ),
  'tile-grid': (
    <>
      <rect x="4" y="4" width="7" height="7" />
      <rect x="13" y="4" width="7" height="7" />
      <rect x="4" y="13" width="7" height="7" />
      <rect x="13" y="13" width="7" height="7" />
    </>
  ),
  'ply-sheets': (
    <>
      <rect x="5" y="14" width="14" height="4" />
      <rect x="5" y="9" width="14" height="4" />
      <rect x="5" y="4" width="14" height="4" />
    </>
  ),
  'paint-tin': (
    <>
      <path d="M6 8h12v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8Z" />
      <path d="M6 8 5 5h14l-1 3" />
      <path d="M9.5 5V4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" />
    </>
  ),
  'water-shield': (
    <>
      <path d="M12 3l7 3.2v5.8c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6.2L12 3Z" />
      <path d="M12 8.2c1.7 2 2.5 3.4 2.5 4.6a2.5 2.5 0 1 1-5 0c0-1.2.8-2.6 2.5-4.6Z" />
    </>
  ),
  tank: (
    <>
      <path d="M6 9c0-2.2 2.7-4 6-4s6 1.8 6 4v8c0 2.2-2.7 4-6 4s-6-1.8-6-4V9Z" />
      <path d="M6 9c0 2.2 2.7 4 6 4s6-1.8 6-4" />
    </>
  ),
  'wire-coil': (
    <path d="M3 13c1.5-4.2 3-4.2 4.5 0s3 4.2 4.5 0 3-4.2 4.5 0 3 4.2 4.5 0" />
  ),
  'switch-plate': (
    <>
      <rect x="5" y="4" width="14" height="16" rx="1" />
      <rect x="9" y="9" width="6" height="6" />
    </>
  ),
  breaker: (
    <>
      <rect x="6" y="4" width="12" height="16" />
      <path d="M12 8v4" />
      <path d="M9 16h6" />
    </>
  ),
  'conduit-bend': (
    <>
      <path d="M6 5v7a6 6 0 0 0 6 6h6" />
      <path d="M9 5v7a3 3 0 0 0 3 3h6" />
    </>
  ),
  bulb: (
    <>
      <path d="M12 3a6 6 0 0 0-3 11.2c.6.4 1 1 1 1.8h4c0-.8.4-1.4 1-1.8A6 6 0 0 0 12 3Z" />
      <path d="M9.5 16h5" />
      <path d="M10.3 19h3.4" />
    </>
  ),
  fan: (
    <>
      <circle cx="12" cy="12" r="1.6" />
      <path d="M12 12 5.5 8.2" />
      <path d="M12 12 18.5 8.2" />
      <path d="M12 12V20" />
    </>
  ),
  'pipe-elbow': (
    <>
      <path d="M6 4v7a7 7 0 0 0 7 7h7" />
      <path d="M4 4h4" />
      <path d="M20 16v4" />
    </>
  ),
  tap: (
    <>
      <path d="M6 8h5" />
      <path d="M11 8a6 6 0 0 1 6 6v2" />
      <path d="M17 10.5v5.5" />
      <path d="M8 4v4" />
    </>
  ),
  hinge: (
    <>
      <rect x="15" y="3" width="5" height="18" rx="2.5" />
      <rect x="4" y="7" width="10" height="3" />
      <rect x="4" y="14" width="10" height="3" />
    </>
  ),
  padlock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="14.6" r="1" />
      <path d="M12 15.6v1.8" />
    </>
  ),
  bolt: (
    <>
      <path d="M12 3.5 18 7v10l-6 3.5-6-3.5V7l6-3.5Z" />
      <path d="M9 12h6" />
    </>
  ),
  'hard-hat': (
    <>
      <path d="M4 16a8 8 0 0 1 16 0" />
      <path d="M3 16h18" />
      <path d="M12 8V5.5" />
    </>
  ),
  drill: (
    <>
      <path d="M4 11h9v4H4z" />
      <path d="M13 12h4l3-2v6l-3-2h-4" />
      <path d="M8 15v3" />
    </>
  ),
};

export interface CategoryIconProps {
  name: CategoryIconName;
  size?: number;
  className?: string;
}

/** One glyph from the category icon set (DESIGN.md §4.4). */
export function CategoryIcon({ name, size = 24, className }: CategoryIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      {PATHS[name]}
    </svg>
  );
}
