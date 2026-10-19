import { MAX_PAGE_SIZE, PAGE_KEYS, type CategoryNode } from '@aricon/shared';
import type { MetadataRoute } from 'next';
import { getBrands, getCategories, getProducts } from '@/lib/api-server';
import { routes } from '@/lib/routes';
import { absoluteUrl } from '@/lib/site';

// Rendered on request (the API isn't there during the CI build); the API reads below are cached
// with the catalog tags, so a crawler hitting /sitemap.xml costs a render, not API calls.
export const dynamic = 'force-dynamic';

/** Enough for any catalog this store will have; stops a runaway loop if the API misreports totals. */
const MAX_PRODUCT_PAGES = 200;

function flatten(nodes: readonly CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

async function productSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  for (let page = 1; page <= MAX_PRODUCT_PAGES; page += 1) {
    const { data, meta } = await getProducts({ page, pageSize: MAX_PAGE_SIZE }, { cached: true });
    slugs.push(...data.map((product) => product.slug));
    if (page * meta.pageSize >= meta.total || data.length === 0) break;
  }
  return slugs;
}

/** `/sitemap.xml` (SPEC §14): home, active categories, brands, products and content pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, brands, products] = await Promise.all([getCategories(), getBrands(), productSlugs()]);
  return [
    { url: absoluteUrl(routes.home), changeFrequency: 'daily', priority: 1 },
    ...flatten(categories)
      .filter((category) => category.productCount > 0)
      .map((category) => ({ url: absoluteUrl(routes.category(category.slug)), changeFrequency: 'daily' as const, priority: 0.8 })),
    ...brands.map((brand) => ({ url: absoluteUrl(routes.brand(brand.slug)), changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...products.map((slug) => ({ url: absoluteUrl(routes.product(slug)), changeFrequency: 'daily' as const, priority: 0.7 })),
    ...PAGE_KEYS.map((key) => ({ url: absoluteUrl(routes.page(key)), changeFrequency: 'monthly' as const, priority: 0.3 })),
  ];
}
