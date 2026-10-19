import { imageUrl, UNITS, type BulkTier } from '@aricon/shared';
import type { ProductLean } from '../../models/product.model.js';
import type { CellValue, SheetData } from '../spreadsheets/xlsx.js';

/**
 * The product spreadsheet (SPEC §12.3): one row per **variant**, the same columns for the import
 * template, the products export and the import itself — so an export can be edited and imported
 * back.
 */
export const PRODUCT_SHEET_COLUMNS = [
  'product_slug',
  'product_name',
  'brand',
  'category_slug',
  'type',
  'unit',
  'description',
  'status',
  'sku',
  'variant_label',
  'pack_size',
  'grade',
  'colour',
  'size',
  'mrp',
  'price',
  'tier1_min_qty',
  'tier1_price',
  'tier2_min_qty',
  'tier2_price',
  'tier3_min_qty',
  'tier3_price',
  'stock',
  'low_stock_threshold',
  'image_urls',
] as const;
export type ProductSheetColumn = (typeof PRODUCT_SHEET_COLUMNS)[number];

/** The template has three tier column pairs (SPEC §12.3). */
export const SHEET_TIERS = 3;

const MONEY_COLUMNS = new Set<ProductSheetColumn>(['mrp', 'price', 'tier1_price', 'tier2_price', 'tier3_price']);
const WIDE_COLUMNS = new Set<ProductSheetColumn>(['product_name', 'description', 'image_urls']);

export const PRODUCT_SHEET_NAME = 'Products';

function columns(): SheetData['columns'] {
  return PRODUCT_SHEET_COLUMNS.map((header) => ({
    header,
    width: WIDE_COLUMNS.has(header) ? 40 : header.length + 4,
    money: MONEY_COLUMNS.has(header),
  }));
}

/** What to put in each column, for the template's second sheet. */
const INSTRUCTIONS: readonly [ProductSheetColumn | '', string][] = [
  ['product_slug', 'Optional. Rows with the same slug are one product; empty = made from the product name.'],
  ['product_name', 'Required for a new product.'],
  ['brand', 'Brand name or slug. It must already exist.'],
  ['category_slug', 'It must already exist.'],
  ['type', 'Optional, e.g. OPC or Emulsion.'],
  ['unit', `One of: ${UNITS.join(', ')}.`],
  ['description', 'Optional. Markdown.'],
  ['status', 'active or hidden. New products default to hidden.'],
  ['sku', 'Required. An existing SKU updates that variant; a new SKU adds a variant.'],
  ['variant_label', 'Required for a new SKU, e.g. "50 kg bag".'],
  ['pack_size', 'Optional variant option.'],
  ['grade', 'Optional variant option.'],
  ['colour', 'Optional variant option.'],
  ['size', 'Optional variant option.'],
  ['mrp', 'Whole rupees. Needs price permission.'],
  ['price', 'Whole rupees, not above MRP. Needs price permission.'],
  ['tier1_min_qty', 'Optional bulk price: from this quantity...'],
  ['tier1_price', '...this price. Tiers need higher quantities and lower prices each time. Needs price permission.'],
  ['tier2_min_qty', 'Optional second tier.'],
  ['tier2_price', ''],
  ['tier3_min_qty', 'Optional third tier.'],
  ['tier3_price', 'Variants with more bulk tiers than three: change those tiers in the admin panel.'],
  ['stock', 'Optional. The new stock count (not a change). Needs stock permission; the difference is recorded.'],
  ['low_stock_threshold', 'Optional. Low-stock warning level.'],
  ['image_urls', 'Optional. https links to photos, separated by commas; used when the product is created.'],
  ['', 'Leave the header row as it is. Up to 5 MB per file.'],
];

/** Empty Products sheet plus the instructions (`GET /api/admin/products/import-template`). */
export function templateSheets(): SheetData[] {
  return [
    { name: PRODUCT_SHEET_NAME, columns: columns(), rows: [] },
    {
      name: 'Instructions',
      columns: [
        { header: 'Column', width: 22 },
        { header: 'What to enter', width: 100 },
      ],
      rows: INSTRUCTIONS.map(([column, text]) => [column, text]),
    },
  ];
}

export interface ProductSheetContext {
  categorySlugs: ReadonlyMap<string, string>;
  publicImageBaseUrl: string;
}

function tierCells(tiers: readonly BulkTier[]): CellValue[] {
  const cells: CellValue[] = [];
  for (let index = 0; index < SHEET_TIERS; index += 1) {
    const tier = tiers[index];
    cells.push(tier?.minQty ?? null, tier?.price ?? null);
  }
  return cells;
}

/** `GET /api/admin/products/export`: one row per variant, in template order. */
export function productExportSheet(products: AsyncIterable<ProductLean>, context: ProductSheetContext): SheetData {
  async function* rows(): AsyncIterable<CellValue[]> {
    for await (const product of products) {
      const images = product.images.map((image) => imageUrl(context.publicImageBaseUrl, image.key, 1600)).join(', ');
      let first = true;
      for (const variant of product.variants) {
        yield [
          product.slug,
          product.name,
          product.brandName,
          context.categorySlugs.get(String(product.categoryId)) ?? '',
          product.type ?? '',
          product.unit,
          product.description,
          product.status,
          variant.sku,
          variant.label,
          variant.options?.packSize ?? '',
          variant.options?.grade ?? '',
          variant.options?.colour ?? '',
          variant.options?.size ?? '',
          variant.mrp,
          variant.price,
          ...tierCells(variant.bulkTiers),
          variant.stock,
          variant.lowStockThreshold,
          // Photos once per product: the import uses them only when it creates the product.
          first ? images : '',
        ];
        first = false;
      }
    }
  }
  return { name: PRODUCT_SHEET_NAME, columns: columns(), rows: rows() };
}
