import type { Unit, VariantOptionKey } from '@aricon/shared';

export interface FixtureVariant {
  id: string;
  sku: string;
  label: string;
  options: Partial<Record<VariantOptionKey, string>>;
  mrp: number;
  price: number;
  bulkTiers: { minQty: number; price: number }[];
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
}

export interface FixtureProduct {
  id: string;
  slug: string;
  name: string;
  brandSlug: string;
  /** Leaf (sub-)category slug. */
  categorySlug: string;
  type: string | null;
  unit: Unit;
  description: string;
  specifications: { label: string; value: string }[];
  variants: FixtureVariant[];
  isFeatured: boolean;
  isDeal: boolean;
  relatedSlugs: string[];
  /** ISO date; drives "Newest" sort and new arrivals. */
  createdAt: string;
}

function variant(
  partial: Omit<FixtureVariant, 'lowStockThreshold' | 'isActive'> & { lowStockThreshold?: number },
): FixtureVariant {
  return { lowStockThreshold: 5, isActive: true, ...partial };
}

/** Demo catalog (SPEC §19): realistic brands, prices and bulk tiers, a few low-stock/out-of-stock examples. */
export const PRODUCTS: FixtureProduct[] = [
  {
    id: 'prod-lucky-opc',
    slug: 'lucky-cement-opc-50kg',
    name: 'Lucky Cement OPC',
    brandSlug: 'lucky-cement',
    categorySlug: 'opc-cement',
    type: 'OPC',
    unit: 'bag',
    description:
      'Ordinary Portland Cement for structural concrete, columns and slabs. Consistent strength gain and reliable setting time, trusted on sites across Karachi.',
    specifications: [
      { label: 'Type', value: 'OPC (Ordinary Portland Cement)' },
      { label: 'Standard', value: 'PS 232' },
      { label: 'Bag weight', value: '50 kg' },
    ],
    variants: [
      variant({
        id: 'var-lucky-opc-50', sku: 'LKY-OPC-50', label: '50 kg bag', options: {},
        mrp: 1600, price: 1550, bulkTiers: [{ minQty: 10, price: 1530 }, { minQty: 30, price: 1510 }, { minQty: 50, price: 1490 }],
        stock: 400,
      }),
    ],
    isFeatured: true,
    isDeal: false,
    relatedSlugs: ['dg-cement-opc-50kg', 'bestway-cement-ppc-50kg'],
    createdAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'prod-dg-opc',
    slug: 'dg-cement-opc-50kg',
    name: 'DG Cement OPC',
    brandSlug: 'dg-cement',
    categorySlug: 'opc-cement',
    type: 'OPC',
    unit: 'bag',
    description:
      'General-purpose Ordinary Portland Cement suited to foundations, beams and precast work, with fine, consistent grinding.',
    specifications: [
      { label: 'Type', value: 'OPC (Ordinary Portland Cement)' },
      { label: 'Bag weight', value: '50 kg' },
    ],
    variants: [
      variant({
        id: 'var-dg-opc-50', sku: 'DG-OPC-50', label: '50 kg bag', options: {},
        mrp: 1560, price: 1520, bulkTiers: [{ minQty: 10, price: 1500 }, { minQty: 50, price: 1470 }],
        stock: 250,
      }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['lucky-cement-opc-50kg', 'bestway-cement-ppc-50kg'],
    createdAt: '2026-05-20T00:00:00.000Z',
  },
  {
    id: 'prod-bestway-ppc',
    slug: 'bestway-cement-ppc-50kg',
    name: 'Bestway Cement PPC',
    brandSlug: 'bestway-cement',
    categorySlug: 'ppc-cement',
    type: 'PPC',
    unit: 'bag',
    description:
      'Portland Pozzolan Cement for plaster, brickwork and general masonry, with lower heat of hydration for better long-term durability. Our best-selling bag, bought by the pallet.',
    specifications: [
      { label: 'Type', value: 'PPC (Portland Pozzolan Cement)' },
      { label: 'Standard', value: 'PS 232' },
      { label: 'Bag weight', value: '50 kg' },
    ],
    variants: [
      variant({
        id: 'var-bestway-ppc-50', sku: 'BW-PPC-50', label: '50 kg bag', options: {},
        mrp: 1500, price: 1450,
        bulkTiers: [
          { minQty: 10, price: 1430 },
          { minQty: 30, price: 1410 },
          { minQty: 50, price: 1395 },
          { minQty: 100, price: 1380 },
        ],
        stock: 600,
      }),
    ],
    isFeatured: true,
    isDeal: true,
    relatedSlugs: ['lucky-cement-opc-50kg', 'lucky-cement-ppc-50kg'],
    createdAt: '2026-07-10T00:00:00.000Z',
  },
  {
    id: 'prod-lucky-ppc',
    slug: 'lucky-cement-ppc-50kg',
    name: 'Lucky Cement PPC',
    brandSlug: 'lucky-cement',
    categorySlug: 'ppc-cement',
    type: 'PPC',
    unit: 'bag',
    description: 'Portland Pozzolan Cement for masonry and plaster work, with good workability for hand mixing on site.',
    specifications: [
      { label: 'Type', value: 'PPC (Portland Pozzolan Cement)' },
      { label: 'Bag weight', value: '50 kg' },
    ],
    variants: [
      variant({
        id: 'var-lucky-ppc-50', sku: 'LKY-PPC-50', label: '50 kg bag', options: {},
        mrp: 1510, price: 1470, bulkTiers: [{ minQty: 10, price: 1450 }, { minQty: 50, price: 1410 }],
        stock: 6, lowStockThreshold: 10,
      }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['bestway-cement-ppc-50kg'],
    createdAt: '2026-04-15T00:00:00.000Z',
  },
  {
    id: 'prod-bestway-plaster',
    slug: 'bestway-wall-plaster-40kg',
    name: 'Bestway Wall Plaster',
    brandSlug: 'bestway-cement',
    categorySlug: 'wall-plaster',
    type: 'Plaster',
    unit: 'bag',
    description: 'Ready-mixed gypsum wall plaster for a smooth, paint-ready finish on interior walls and ceilings.',
    specifications: [
      { label: 'Coverage', value: '~14 sq ft at 12 mm' },
      { label: 'Bag weight', value: '40 kg' },
    ],
    variants: [
      variant({ id: 'var-bestway-plaster-40', sku: 'BW-PLST-40', label: '40 kg bag', options: {}, mrp: 980, price: 950, bulkTiers: [], stock: 120 }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['bestway-cement-ppc-50kg'],
    createdAt: '2026-03-05T00:00:00.000Z',
  },
  {
    id: 'prod-master-floor-tile',
    slug: 'master-tiles-floor-tile-60x60',
    name: 'Master Tiles Floor Tile',
    brandSlug: 'master-tiles',
    categorySlug: 'floor-tiles',
    type: 'Glazed vitrified',
    unit: 'box',
    description:
      'Glazed vitrified floor tile with a matte finish, low water absorption and consistent shade across boxes. Covers about 15.5 sq ft per box.',
    specifications: [
      { label: 'Size', value: '60 × 60 cm' },
      { label: 'Finish', value: 'Matte' },
      { label: 'Coverage per box', value: '15.5 sq ft (4 pieces)' },
    ],
    variants: [
      variant({
        id: 'var-master-floor-ivory', sku: 'MT-FLR-6060-IVR', label: '60×60 cm, Ivory', options: { size: '60×60 cm', colour: 'Ivory' },
        mrp: 2300, price: 2200, bulkTiers: [{ minQty: 20, price: 2150 }, { minQty: 50, price: 2100 }], stock: 300,
      }),
      variant({
        id: 'var-master-floor-grey', sku: 'MT-FLR-6060-GRY', label: '60×60 cm, Grey', options: { size: '60×60 cm', colour: 'Grey' },
        mrp: 2300, price: 2200, bulkTiers: [{ minQty: 20, price: 2150 }, { minQty: 50, price: 2100 }], stock: 0,
      }),
    ],
    isFeatured: true,
    isDeal: false,
    relatedSlugs: ['sonex-wall-tile-30x60', 'master-tiles-adhesive-20kg'],
    createdAt: '2026-06-25T00:00:00.000Z',
  },
  {
    id: 'prod-sonex-wall-tile',
    slug: 'sonex-wall-tile-30x60',
    name: 'Sonex Wall Tile',
    brandSlug: 'sonex',
    categorySlug: 'wall-tiles',
    type: 'Glazed ceramic',
    unit: 'box',
    description: 'Glazed ceramic wall tile for kitchens and bathrooms, with a subtle gloss finish and rectified edges.',
    specifications: [
      { label: 'Size', value: '30 × 60 cm' },
      { label: 'Finish', value: 'Glossy' },
    ],
    variants: [
      variant({
        id: 'var-sonex-wall-white', sku: 'SNX-WLL-3060-WHT', label: '30×60 cm, White', options: { size: '30×60 cm', colour: 'White' },
        mrp: 1700, price: 1650, bulkTiers: [{ minQty: 20, price: 1600 }], stock: 80,
      }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['master-tiles-floor-tile-60x60'],
    createdAt: '2026-05-02T00:00:00.000Z',
  },
  {
    id: 'prod-master-adhesive',
    slug: 'master-tiles-adhesive-20kg',
    name: 'Master Tiles Tile Adhesive',
    brandSlug: 'master-tiles',
    categorySlug: 'tile-adhesive-grout',
    type: 'Adhesive',
    unit: 'bag',
    description: 'Grey cement-based tile adhesive for floor and wall tiles on cement plaster and concrete.',
    specifications: [{ label: 'Bag weight', value: '20 kg' }],
    variants: [
      variant({ id: 'var-master-adhesive-20', sku: 'MT-ADH-20', label: '20 kg bag', options: {}, mrp: 880, price: 850, bulkTiers: [], stock: 200 }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['sonex-tile-grout-5kg'],
    createdAt: '2026-02-18T00:00:00.000Z',
  },
  {
    id: 'prod-sonex-grout',
    slug: 'sonex-tile-grout-5kg',
    name: 'Sonex Tile Grout',
    brandSlug: 'sonex',
    categorySlug: 'tile-adhesive-grout',
    type: 'Grout',
    unit: 'kg',
    description: 'Fine-texture joint grout for tile gaps up to 6 mm, water-resistant once cured.',
    specifications: [{ label: 'Pack size', value: '5 kg' }],
    variants: [
      variant({
        id: 'var-sonex-grout-5', sku: 'SNX-GRT-5', label: '5 kg pack', options: { packSize: '5 kg' },
        mrp: 340, price: 320, bulkTiers: [{ minQty: 10, price: 300 }], stock: 150,
      }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['master-tiles-adhesive-20kg'],
    createdAt: '2026-01-22T00:00:00.000Z',
  },
  {
    id: 'prod-century-plywood',
    slug: 'century-plywood-12mm',
    name: 'Century Plywood',
    brandSlug: 'century-boards',
    categorySlug: 'plywood-sheets',
    type: 'Plywood',
    unit: 'sheet',
    description: 'Boiling water proof (BWP) grade plywood for furniture and shuttering, resists moisture and delamination.',
    specifications: [
      { label: 'Thickness', value: '12 mm' },
      { label: 'Size', value: '8 × 4 ft' },
      { label: 'Grade', value: 'BWP' },
    ],
    variants: [
      variant({
        id: 'var-century-ply-12', sku: 'CTY-PLY-12', label: '12 mm, 8×4 ft, BWP', options: { size: '8×4 ft', grade: 'BWP' },
        mrp: 4400, price: 4200, bulkTiers: [{ minQty: 10, price: 4100 }, { minQty: 25, price: 4000 }], stock: 90,
      }),
    ],
    isFeatured: false,
    isDeal: true,
    relatedSlugs: ['century-mdf-18mm', 'century-block-board-19mm'],
    createdAt: '2026-05-30T00:00:00.000Z',
  },
  {
    id: 'prod-century-mdf',
    slug: 'century-mdf-18mm',
    name: 'Century MDF Board',
    brandSlug: 'century-boards',
    categorySlug: 'mdf-boards',
    type: 'MDF',
    unit: 'sheet',
    description: 'Medium-density fibreboard with a smooth, uniform surface ready for laminate or paint finish.',
    specifications: [
      { label: 'Thickness', value: '18 mm' },
      { label: 'Size', value: '8 × 4 ft' },
    ],
    variants: [
      variant({ id: 'var-century-mdf-18', sku: 'CTY-MDF-18', label: '18 mm, 8×4 ft', options: { size: '8×4 ft' }, mrp: 3750, price: 3600, bulkTiers: [], stock: 60 }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['century-plywood-12mm'],
    createdAt: '2026-03-28T00:00:00.000Z',
  },
  {
    id: 'prod-century-block',
    slug: 'century-block-board-19mm',
    name: 'Century Block Board',
    brandSlug: 'century-boards',
    categorySlug: 'block-board',
    type: 'Block board',
    unit: 'sheet',
    description: 'Solid-core block board for shelving and cabinetry, stronger and lighter than plain plywood at this thickness.',
    specifications: [
      { label: 'Thickness', value: '19 mm' },
      { label: 'Size', value: '8 × 4 ft' },
    ],
    variants: [
      variant({ id: 'var-century-block-19', sku: 'CTY-BLK-19', label: '19 mm, 8×4 ft', options: { size: '8×4 ft' }, mrp: 4100, price: 3900, bulkTiers: [], stock: 40 }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['century-plywood-12mm'],
    createdAt: '2026-02-11T00:00:00.000Z',
  },
  {
    id: 'prod-berger-emulsion',
    slug: 'berger-weathercoat-emulsion',
    name: 'Berger Weathercoat Emulsion',
    brandSlug: 'berger-paints',
    categorySlug: 'emulsion-paint',
    type: 'Emulsion',
    unit: 'gallon',
    description: 'Weather-resistant exterior emulsion with strong colour retention through Karachi\'s heat and monsoon.',
    specifications: [
      { label: 'Coverage', value: '~120 sq ft per gallon, 2 coats' },
      { label: 'Finish', value: 'Matte' },
    ],
    variants: [
      variant({
        id: 'var-berger-emul-white', sku: 'BRG-EMUL-WHT', label: '1 gallon, Brilliant White', options: { colour: 'Brilliant White' },
        mrp: 5500, price: 5200, bulkTiers: [{ minQty: 5, price: 5000 }, { minQty: 10, price: 4800 }], stock: 70,
      }),
      variant({
        id: 'var-berger-emul-ivory', sku: 'BRG-EMUL-IVR', label: '1 gallon, Ivory', options: { colour: 'Ivory' },
        mrp: 5500, price: 5200, bulkTiers: [{ minQty: 5, price: 5000 }, { minQty: 10, price: 4800 }], stock: 0,
      }),
    ],
    isFeatured: true,
    isDeal: false,
    relatedSlugs: ['ici-dulux-weathershield', 'kohinoor-primer-4l'],
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'prod-dulux-weathershield',
    slug: 'ici-dulux-weathershield',
    name: 'ICI Dulux Weathershield',
    brandSlug: 'ici-dulux',
    categorySlug: 'emulsion-paint',
    type: 'Emulsion',
    unit: 'gallon',
    description: 'Premium exterior emulsion with algae and fungus resistance for a longer-lasting finish.',
    specifications: [{ label: 'Coverage', value: '~110 sq ft per gallon, 2 coats' }],
    variants: [
      variant({
        id: 'var-dulux-weathershield-white', sku: 'DLX-WTS-WHT', label: '1 gallon, White', options: { colour: 'White' },
        mrp: 6400, price: 6100, bulkTiers: [{ minQty: 5, price: 5900 }], stock: 55,
      }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['berger-weathercoat-emulsion'],
    createdAt: '2026-04-08T00:00:00.000Z',
  },
  {
    id: 'prod-berger-enamel',
    slug: 'berger-luxol-enamel',
    name: 'Berger Luxol Enamel',
    brandSlug: 'berger-paints',
    categorySlug: 'enamel-paint',
    type: 'Enamel',
    unit: 'litre',
    description: 'High-gloss synthetic enamel for doors, grills and metal railings, with good scrub resistance.',
    specifications: [{ label: 'Finish', value: 'Gloss' }],
    variants: [
      variant({ id: 'var-berger-enamel-black', sku: 'BRG-ENL-BLK', label: '1 litre, Black', options: { colour: 'Black' }, mrp: 1500, price: 1450, bulkTiers: [], stock: 90 }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['berger-weathercoat-emulsion'],
    createdAt: '2026-01-30T00:00:00.000Z',
  },
  {
    id: 'prod-kohinoor-primer',
    slug: 'kohinoor-primer-4l',
    name: 'Kohinoor Wall Primer',
    brandSlug: 'kohinoor-paints',
    categorySlug: 'primers-undercoats',
    type: 'Primer',
    unit: 'gallon',
    description: 'Water-based wall primer that seals fresh plaster and gives even paint absorption.',
    specifications: [{ label: 'Coverage', value: '~150 sq ft per gallon' }],
    variants: [
      variant({ id: 'var-kohinoor-primer-4l', sku: 'KHN-PRM-4L', label: '1 gallon', options: {}, mrp: 3350, price: 3200, bulkTiers: [], stock: 40 }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['berger-weathercoat-emulsion'],
    createdAt: '2026-02-25T00:00:00.000Z',
  },
  {
    id: 'prod-kohinoor-membrane',
    slug: 'kohinoor-waterproofing-membrane',
    name: 'Kohinoor Waterproofing Membrane',
    brandSlug: 'kohinoor-paints',
    categorySlug: 'waterproofing-membrane',
    type: 'Membrane',
    unit: 'roll',
    description: 'Self-adhesive bitumen membrane for roof and terrace waterproofing before tiling.',
    specifications: [{ label: 'Size', value: '1 m × 10 m' }],
    variants: [
      variant({
        id: 'var-kohinoor-membrane-1x10', sku: 'KHN-MEM-1X10', label: '1 m × 10 m roll', options: { size: '1m x 10m' },
        mrp: 8900, price: 8500, bulkTiers: [{ minQty: 5, price: 8200 }], stock: 25,
      }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['berger-waterseal-coating'],
    createdAt: '2026-03-14T00:00:00.000Z',
  },
  {
    id: 'prod-berger-waterseal',
    slug: 'berger-waterseal-coating',
    name: 'Berger Waterseal Coating',
    brandSlug: 'berger-paints',
    categorySlug: 'waterproofing-coating',
    type: 'Coating',
    unit: 'pail',
    description: 'Elastomeric waterproof coating for roofs and water tanks, brush or roller applied.',
    specifications: [{ label: 'Coverage', value: '~40 sq ft per pail, 2 coats' }],
    variants: [
      variant({ id: 'var-berger-waterseal-pail', sku: 'BRG-WTS-PAIL', label: '1 pail', options: {}, mrp: 4400, price: 4200, bulkTiers: [], stock: 30 }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['kohinoor-waterproofing-membrane'],
    createdAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: 'prod-newage-wire-736',
    slug: 'newage-cable-7-36',
    name: 'Newage Cables 7/36 Copper Wire',
    brandSlug: 'newage-cables',
    categorySlug: 'wires-cables',
    type: 'Copper wire',
    unit: 'coil',
    description: 'Single-core PVC insulated copper wire for lighting and socket circuits, 90 m per coil.',
    specifications: [
      { label: 'Size', value: '7/36' },
      { label: 'Coil length', value: '90 m' },
    ],
    variants: [
      variant({
        id: 'var-newage-736-red', sku: 'NWG-736-RED', label: '7/36, Red', options: { size: '7/36', colour: 'Red' },
        mrp: 5600, price: 5400, bulkTiers: [{ minQty: 5, price: 5250 }, { minQty: 10, price: 5100 }], stock: 200,
      }),
      variant({
        id: 'var-newage-736-black', sku: 'NWG-736-BLK', label: '7/36, Black', options: { size: '7/36', colour: 'Black' },
        mrp: 5600, price: 5400, bulkTiers: [{ minQty: 5, price: 5250 }, { minQty: 10, price: 5100 }], stock: 150,
      }),
      variant({
        id: 'var-newage-736-yellow', sku: 'NWG-736-YLW', label: '7/36, Yellow', options: { size: '7/36', colour: 'Yellow' },
        mrp: 5600, price: 5400, bulkTiers: [{ minQty: 5, price: 5250 }, { minQty: 10, price: 5100 }], stock: 0,
      }),
    ],
    isFeatured: true,
    isDeal: true,
    relatedSlugs: ['newage-cable-7-29', 'gm-switch-1-gang'],
    createdAt: '2026-06-18T00:00:00.000Z',
  },
  {
    id: 'prod-newage-wire-729',
    slug: 'newage-cable-7-29',
    name: 'Newage Cables 7/29 Copper Wire',
    brandSlug: 'newage-cables',
    categorySlug: 'wires-cables',
    type: 'Copper wire',
    unit: 'coil',
    description: 'Lighter-gauge single-core copper wire for lighting circuits and low-load points.',
    specifications: [
      { label: 'Size', value: '7/29' },
      { label: 'Coil length', value: '90 m' },
    ],
    variants: [
      variant({
        id: 'var-newage-729-red', sku: 'NWG-729-RED', label: '7/29, Red', options: { size: '7/29', colour: 'Red' },
        mrp: 3950, price: 3800, bulkTiers: [{ minQty: 10, price: 3700 }], stock: 120,
      }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['newage-cable-7-36'],
    createdAt: '2026-04-22T00:00:00.000Z',
  },
  {
    id: 'prod-gm-switch',
    slug: 'gm-switch-1-gang',
    name: 'GM Switches Modular Switch',
    brandSlug: 'gm-switches',
    categorySlug: 'switches-sockets',
    type: 'Switch',
    unit: 'piece',
    description: 'One-gang modular switch with a smooth rocker action, fits standard local wall plates.',
    specifications: [{ label: 'Rating', value: '6 A, 250 V' }],
    variants: [
      variant({
        id: 'var-gm-switch-white', sku: 'GM-SW1-WHT', label: '1-gang, White', options: { colour: 'White' },
        mrp: 200, price: 180, bulkTiers: [{ minQty: 20, price: 170 }, { minQty: 50, price: 160 }], stock: 500,
      }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['gm-socket-2-pin'],
    createdAt: '2026-05-11T00:00:00.000Z',
  },
  {
    id: 'prod-gm-socket',
    slug: 'gm-socket-2-pin',
    name: 'GM Switches Socket',
    brandSlug: 'gm-switches',
    categorySlug: 'switches-sockets',
    type: 'Socket',
    unit: 'piece',
    description: 'Two-pin modular socket for general household points.',
    specifications: [{ label: 'Rating', value: '6 A, 250 V' }],
    variants: [
      variant({
        id: 'var-gm-socket-white', sku: 'GM-SKT2-WHT', label: '2-pin, White', options: { colour: 'White' },
        mrp: 240, price: 220, bulkTiers: [], stock: 8, lowStockThreshold: 10,
      }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['gm-switch-1-gang'],
    createdAt: '2026-03-19T00:00:00.000Z',
  },
  {
    id: 'prod-pel-mcb',
    slug: 'pel-mcb-32a',
    name: 'PEL MCB 32A Single Pole',
    brandSlug: 'pel',
    categorySlug: 'breakers-distribution-boards',
    type: 'MCB',
    unit: 'piece',
    description: 'Single-pole miniature circuit breaker for overload and short-circuit protection.',
    specifications: [
      { label: 'Rating', value: '32 A' },
      { label: 'Poles', value: '1' },
    ],
    variants: [
      variant({ id: 'var-pel-mcb-32', sku: 'PEL-MCB-32', label: '32 A, single pole', options: {}, mrp: 700, price: 650, bulkTiers: [{ minQty: 10, price: 620 }], stock: 140 }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['pel-db-8way'],
    createdAt: '2026-02-02T00:00:00.000Z',
  },
  {
    id: 'prod-pel-db',
    slug: 'pel-db-8way',
    name: 'PEL Distribution Board',
    brandSlug: 'pel',
    categorySlug: 'breakers-distribution-boards',
    type: 'Distribution board',
    unit: 'piece',
    description: 'Eight-way surface-mount distribution board with a metal enclosure and hinged cover.',
    specifications: [{ label: 'Ways', value: '8' }],
    variants: [
      variant({ id: 'var-pel-db-8', sku: 'PEL-DB-8', label: '8-way', options: {}, mrp: 3400, price: 3200, bulkTiers: [], stock: 25 }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['pel-mcb-32a'],
    createdAt: '2026-01-08T00:00:00.000Z',
  },
  {
    id: 'prod-boss-upvc',
    slug: 'boss-upvc-pipe-4inch',
    name: 'Boss Pipes uPVC Pipe',
    brandSlug: 'boss-pipes',
    categorySlug: 'pipes-fittings',
    type: 'uPVC',
    unit: 'length',
    description: 'uPVC drainage pipe, 10 ft length, for waste and soil lines.',
    specifications: [
      { label: 'Diameter', value: '4 inch' },
      { label: 'Length', value: '10 ft' },
    ],
    variants: [
      variant({
        id: 'var-boss-upvc-4', sku: 'BOSS-UPVC-4', label: '4 inch, 10 ft', options: { size: '4 inch' },
        mrp: 1500, price: 1450, bulkTiers: [{ minQty: 10, price: 1400 }, { minQty: 30, price: 1350 }], stock: 200,
      }),
    ],
    isFeatured: false,
    isDeal: true,
    relatedSlugs: ['boss-pprc-pipe-1inch'],
    createdAt: '2026-06-05T00:00:00.000Z',
  },
  {
    id: 'prod-boss-pprc',
    slug: 'boss-pprc-pipe-1inch',
    name: 'Boss Pipes PPRC Pipe',
    brandSlug: 'boss-pipes',
    categorySlug: 'pipes-fittings',
    type: 'PPRC',
    unit: 'length',
    description: 'PPRC pressure pipe for hot and cold water supply lines, 4 m length.',
    specifications: [
      { label: 'Diameter', value: '1 inch' },
      { label: 'Length', value: '4 m' },
    ],
    variants: [
      variant({ id: 'var-boss-pprc-1', sku: 'BOSS-PPRC-1', label: '1 inch, 4 m', options: { size: '1 inch' }, mrp: 400, price: 380, bulkTiers: [], stock: 300 }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['boss-upvc-pipe-4inch'],
    createdAt: '2026-04-29T00:00:00.000Z',
  },
  {
    id: 'prod-boss-tap',
    slug: 'boss-basin-tap-chrome',
    name: 'Boss Pipes Basin Tap',
    brandSlug: 'boss-pipes',
    categorySlug: 'taps-showers',
    type: 'Tap',
    unit: 'piece',
    description: 'Single-lever chrome-plated basin tap with a ceramic disc cartridge.',
    specifications: [{ label: 'Finish', value: 'Chrome' }],
    variants: [
      variant({ id: 'var-boss-tap-chrome', sku: 'BOSS-TAP-CHR', label: 'Chrome', options: { colour: 'Chrome' }, mrp: 2400, price: 2200, bulkTiers: [], stock: 60 }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['boss-shower-set'],
    createdAt: '2026-02-14T00:00:00.000Z',
  },
  {
    id: 'prod-boss-shower',
    slug: 'boss-shower-set',
    name: 'Boss Pipes Shower Set',
    brandSlug: 'boss-pipes',
    categorySlug: 'taps-showers',
    type: 'Shower',
    unit: 'set',
    description: 'Overhead shower with hand shower, hose and wall mixer, chrome finish.',
    specifications: [{ label: 'Includes', value: 'Overhead shower, hand shower, mixer' }],
    variants: [
      variant({ id: 'var-boss-shower-chrome', sku: 'BOSS-SHW-CHR', label: 'Chrome', options: { colour: 'Chrome' }, mrp: 6900, price: 6500, bulkTiers: [{ minQty: 5, price: 6300 }], stock: 0 }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['boss-basin-tap-chrome'],
    createdAt: '2026-01-25T00:00:00.000Z',
  },
  {
    id: 'prod-master-hinge',
    slug: 'master-locks-door-hinge-4inch',
    name: 'Master Locks Door Hinge',
    brandSlug: 'master-locks',
    categorySlug: 'hinges-handles',
    type: 'Hinge',
    unit: 'piece',
    description: 'Stainless steel butt hinge for interior and exterior doors, ball-bearing action.',
    specifications: [{ label: 'Size', value: '4 inch' }],
    variants: [
      variant({
        id: 'var-master-hinge-4', sku: 'ML-HNG-4', label: '4 inch', options: { size: '4 inch' },
        mrp: 140, price: 120, bulkTiers: [{ minQty: 50, price: 110 }, { minQty: 100, price: 100 }], stock: 800,
      }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['master-locks-padlock-50mm'],
    createdAt: '2026-03-02T00:00:00.000Z',
  },
  {
    id: 'prod-master-padlock',
    slug: 'master-locks-padlock-50mm',
    name: 'Master Locks Padlock',
    brandSlug: 'master-locks',
    categorySlug: 'locks',
    type: 'Padlock',
    unit: 'piece',
    description: 'Solid brass padlock with a hardened steel shackle, 3 keys included.',
    specifications: [{ label: 'Size', value: '50 mm' }],
    variants: [
      variant({ id: 'var-master-padlock-50', sku: 'ML-PL-50', label: '50 mm', options: { size: '50mm' }, mrp: 900, price: 850, bulkTiers: [], stock: 90 }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['master-locks-door-hinge-4inch'],
    createdAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 'prod-dewalt-drill',
    slug: 'dewalt-impact-drill-13mm',
    name: 'DeWalt Impact Drill',
    brandSlug: 'dewalt',
    categorySlug: 'power-tools',
    type: 'Drill',
    unit: 'piece',
    description: 'Corded 13 mm impact drill with variable speed and reverse, for masonry, wood and metal.',
    specifications: [
      { label: 'Chuck size', value: '13 mm' },
      { label: 'Power', value: '701 W' },
    ],
    variants: [
      variant({ id: 'var-dewalt-drill-13', sku: 'DW-DRL-13', label: '13 mm', options: {}, mrp: 26_000, price: 24_500, bulkTiers: [], stock: 15 }),
    ],
    isFeatured: true,
    isDeal: false,
    relatedSlugs: ['dewalt-angle-grinder-4inch'],
    createdAt: '2026-05-16T00:00:00.000Z',
  },
  {
    id: 'prod-dewalt-grinder',
    slug: 'dewalt-angle-grinder-4inch',
    name: 'DeWalt Angle Grinder',
    brandSlug: 'dewalt',
    categorySlug: 'power-tools',
    type: 'Grinder',
    unit: 'piece',
    description: 'Compact 4 inch angle grinder for cutting and grinding metal, tile and stone.',
    specifications: [
      { label: 'Disc size', value: '4 inch' },
      { label: 'Power', value: '710 W' },
    ],
    variants: [
      variant({ id: 'var-dewalt-grinder-4', sku: 'DW-GRD-4', label: '4 inch', options: {}, mrp: 8700, price: 8200, bulkTiers: [], stock: 20 }),
    ],
    isFeatured: false,
    isDeal: false,
    relatedSlugs: ['dewalt-impact-drill-13mm'],
    createdAt: '2026-02-28T00:00:00.000Z',
  },
];

export const PRODUCT_BY_SLUG = new Map(PRODUCTS.map((product) => [product.slug, product]));
export const PRODUCT_BY_ID = new Map(PRODUCTS.map((product) => [product.id, product]));
