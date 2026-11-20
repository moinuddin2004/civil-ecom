import sharp from 'sharp';

/**
 * Fallback for demo products without a catalogue photograph.
 */

/** One colour per top-level category, so a listing doesn't look like one grey wall. */
const CATEGORY_COLOURS: Record<string, string> = {
  'cement-plaster': '#8C7B6B',
  'tiles-adhesives': '#5B7C8D',
  'plywood-boards': '#A0784A',
  paint: '#B5523B',
  waterproofing: '#2F6F8F',
  electrical: '#C9A227',
  plumbing: '#3D7A5E',
  hardware: '#55606B',
};
const FALLBACK_COLOUR = '#4A5560';

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z0-9]/.test(word))
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export function categoryColour(topLevelSlug: string): string {
  return CATEGORY_COLOURS[topLevelSlug] ?? FALLBACK_COLOUR;
}

/** 1600×1600 PNG: initials in the middle, the product name underneath, "Demo image" in a corner. */
export function productPlaceholder(name: string, colour: string): Promise<Buffer> {
  const label = escapeXml(name.length > 34 ? `${name.slice(0, 33)}…` : name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600">
  <rect width="1600" height="1600" fill="${colour}"/>
  <text x="800" y="860" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="420" font-weight="700" fill="#FFFFFF" fill-opacity="0.92">${escapeXml(initials(name))}</text>
  <text x="800" y="1130" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="72" fill="#FFFFFF" fill-opacity="0.85">${label}</text>
  <text x="1540" y="1550" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="44" fill="#FFFFFF" fill-opacity="0.6">Demo image</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
