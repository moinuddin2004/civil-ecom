/**
 * Demo data for `seed:demo` (SPEC §19): clearly marked demo content for development and staging,
 * to be replaced by the client's real catalog. Ids here are only references between these files;
 * the seed creates real ObjectIds.
 */

export interface FixtureCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Shown as a home page category tile. */
  showOnHome: boolean;
  children: FixtureSubCategory[];
}

export interface FixtureSubCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export const CATEGORIES: FixtureCategory[] = [
  {
    id: 'cat-cement-plaster',
    name: 'Cement & plaster',
    slug: 'cement-plaster',
    description: 'OPC and PPC cement, wall plaster and mortar for structural and finishing work.',
    showOnHome: true,
    children: [
      { id: 'cat-opc-cement', name: 'OPC cement', slug: 'opc-cement', description: null },
      { id: 'cat-ppc-cement', name: 'PPC cement', slug: 'ppc-cement', description: null },
      { id: 'cat-wall-plaster', name: 'Wall plaster', slug: 'wall-plaster', description: null },
    ],
  },
  {
    id: 'cat-tiles-adhesives',
    name: 'Tiles & adhesives',
    slug: 'tiles-adhesives',
    description: 'Floor and wall tiles, tile adhesive and grout in standard site sizes.',
    showOnHome: true,
    children: [
      { id: 'cat-floor-tiles', name: 'Floor tiles', slug: 'floor-tiles', description: null },
      { id: 'cat-wall-tiles', name: 'Wall tiles', slug: 'wall-tiles', description: null },
      { id: 'cat-tile-adhesive', name: 'Tile adhesive & grout', slug: 'tile-adhesive-grout', description: null },
    ],
  },
  {
    id: 'cat-plywood-boards',
    name: 'Plywood & boards',
    slug: 'plywood-boards',
    description: 'Plywood sheets, MDF and block board for carpentry and furniture work.',
    showOnHome: false,
    children: [
      { id: 'cat-plywood-sheets', name: 'Plywood sheets', slug: 'plywood-sheets', description: null },
      { id: 'cat-mdf-boards', name: 'MDF boards', slug: 'mdf-boards', description: null },
      { id: 'cat-block-board', name: 'Block board', slug: 'block-board', description: null },
    ],
  },
  {
    id: 'cat-paint',
    name: 'Paint',
    slug: 'paint',
    description: 'Emulsion and enamel paints, primers and undercoats from genuine brands.',
    showOnHome: true,
    children: [
      { id: 'cat-emulsion-paint', name: 'Emulsion paint', slug: 'emulsion-paint', description: null },
      { id: 'cat-enamel-paint', name: 'Enamel paint', slug: 'enamel-paint', description: null },
      { id: 'cat-primers', name: 'Primers & undercoats', slug: 'primers-undercoats', description: null },
    ],
  },
  {
    id: 'cat-waterproofing',
    name: 'Waterproofing',
    slug: 'waterproofing',
    description: 'Roof and wall waterproofing membranes and coatings.',
    showOnHome: false,
    children: [
      { id: 'cat-waterproof-membrane', name: 'Waterproofing membrane', slug: 'waterproofing-membrane', description: null },
      { id: 'cat-waterproof-coating', name: 'Waterproofing coating', slug: 'waterproofing-coating', description: null },
    ],
  },
  {
    id: 'cat-electrical',
    name: 'Electrical',
    slug: 'electrical',
    description: 'Wires and cables, switches, sockets, breakers and distribution boards.',
    showOnHome: true,
    children: [
      { id: 'cat-wires-cables', name: 'Wires & cables', slug: 'wires-cables', description: null },
      { id: 'cat-switches-sockets', name: 'Switches & sockets', slug: 'switches-sockets', description: null },
      { id: 'cat-breakers-dbs', name: 'Breakers & distribution boards', slug: 'breakers-distribution-boards', description: null },
    ],
  },
  {
    id: 'cat-plumbing',
    name: 'Plumbing',
    slug: 'plumbing',
    description: 'Pipes, fittings, taps and showers for water supply and drainage.',
    showOnHome: true,
    children: [
      { id: 'cat-pipes-fittings', name: 'Pipes & fittings', slug: 'pipes-fittings', description: null },
      { id: 'cat-taps-showers', name: 'Taps & showers', slug: 'taps-showers', description: null },
    ],
  },
  {
    id: 'cat-hardware',
    name: 'Hardware',
    slug: 'hardware',
    description: 'Hinges, handles, locks and power tools for site and workshop.',
    showOnHome: true,
    children: [
      { id: 'cat-hinges-handles', name: 'Hinges & handles', slug: 'hinges-handles', description: null },
      { id: 'cat-locks', name: 'Locks', slug: 'locks', description: null },
      { id: 'cat-power-tools', name: 'Power tools', slug: 'power-tools', description: null },
    ],
  },
];

/** Flat lookup of every category and sub-category by slug. */
export const CATEGORY_BY_SLUG = new Map<string, { id: string; name: string; slug: string; parentSlug: string | null }>();
for (const parent of CATEGORIES) {
  CATEGORY_BY_SLUG.set(parent.slug, { id: parent.id, name: parent.name, slug: parent.slug, parentSlug: null });
  for (const child of parent.children) {
    CATEGORY_BY_SLUG.set(child.slug, { id: child.id, name: child.name, slug: child.slug, parentSlug: parent.slug });
  }
}
