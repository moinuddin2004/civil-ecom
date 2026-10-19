export interface FixtureBrand {
  id: string;
  name: string;
  slug: string;
}

export const BRANDS: FixtureBrand[] = [
  { id: 'brand-lucky', name: 'Lucky Cement', slug: 'lucky-cement' },
  { id: 'brand-dg', name: 'DG Cement', slug: 'dg-cement' },
  { id: 'brand-bestway', name: 'Bestway Cement', slug: 'bestway-cement' },
  { id: 'brand-master-tiles', name: 'Master Tiles', slug: 'master-tiles' },
  { id: 'brand-sonex', name: 'Sonex', slug: 'sonex' },
  { id: 'brand-century', name: 'Century Boards', slug: 'century-boards' },
  { id: 'brand-berger', name: 'Berger Paints', slug: 'berger-paints' },
  { id: 'brand-dulux', name: 'ICI Dulux', slug: 'ici-dulux' },
  { id: 'brand-kohinoor', name: 'Kohinoor Paints', slug: 'kohinoor-paints' },
  { id: 'brand-newage', name: 'Newage Cables', slug: 'newage-cables' },
  { id: 'brand-pel', name: 'PEL', slug: 'pel' },
  { id: 'brand-gm', name: 'GM Switches', slug: 'gm-switches' },
  { id: 'brand-master-locks', name: 'Master Locks', slug: 'master-locks' },
  { id: 'brand-boss', name: 'Boss Pipes', slug: 'boss-pipes' },
  { id: 'brand-dewalt', name: 'DeWalt', slug: 'dewalt' },
];

export const BRAND_BY_SLUG = new Map(BRANDS.map((brand) => [brand.slug, brand]));
