import { BackButton } from "@/components/ui/back-button";
import { imageUrl, type ProductDetail } from "@aricon/shared";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { breadcrumbList, JsonLd } from "@/components/shop/json-ld";
import { ProductCard } from "@/components/shop/product-card";
import { ProductPurchasePanel } from "@/components/shop/product-purchase-panel";
import { ProductSection } from "@/components/shop/product-rail";
import { CARD_CLASS } from "@/components/shop/styles";
import {
  getProduct,
  getPublicSettings,
  getRelated,
  orNotFound,
} from "@/lib/api-server";
import { absoluteUrl, imageBaseUrl } from "@/lib/site";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { ProductImageGallery } from "@/components/shop/product-image-gallery";

interface ProductPageParams {
  slug: string;
}

interface ProductPageProps {
  params: Promise<ProductPageParams>;
}

/**
 * Plain-text excerpt of a Markdown description for `<meta description>` and JSON-LD: strips the
 * common Markdown syntax rather than rendering it, then truncates on a word boundary.
 */
function excerptFromMarkdown(markdown: string, maxLength = 160): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/[#>*_~`|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 1).trimEnd()}…`;
}

/** Absolute URL of the product's main photo (800 px), for Open Graph and JSON-LD; null without one. */
function mainImageUrl(product: ProductDetail): string | null {
  const key = product.images[0]?.key;
  return key ? imageUrl(imageBaseUrl, key, 800) : null;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await orNotFound(getProduct(slug));
  // Many product names already start with the brand ("Lucky Cement OPC"); don't say it twice.
  const title = product.name
    .toLowerCase()
    .startsWith(product.brand.name.toLowerCase())
    ? product.name
    : `${product.brand.name} ${product.name}`;
  const description =
    excerptFromMarkdown(product.description) ||
    `${title} at bulk prices, delivered across Karachi. Cash on delivery or bank transfer.`;
  const path = routes.product(product.slug);
  const image = mainImageUrl(product);

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
      ...(image && {
        images: [{ url: image, alt: product.images[0]?.alt || product.name }],
      }),
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const [product, related, settings] = await Promise.all([
    orNotFound(getProduct(slug)),
    // Related products are a nice-to-have: a failure must not take the product page down.
    getRelated(slug).catch(() => []),
    getPublicSettings(),
  ]);

  const inStock = product.variants.some((variant) => variant.stock > 0);
  const image = mainImageUrl(product);
  const productJsonLd = {
    "@type": "Product",
    name: product.name,
    ...(image && { image }),
    description: excerptFromMarkdown(product.description),
    sku: product.variants[0]?.sku,
    brand: { "@type": "Brand", name: product.brand.name },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(routes.product(product.slug)),
      priceCurrency: "PKR",
      price: product.minPrice,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  const breadcrumbJsonLd = breadcrumbList([
    { name: "Home", url: absoluteUrl(routes.home) },
    ...product.breadcrumbs.map((crumb) => ({
      name: crumb.name,
      url: absoluteUrl(routes.category(crumb.slug)),
    })),
    { name: product.name, url: absoluteUrl(routes.product(product.slug)) },
  ]);

  return (
    <>
      {/* JSON-LD structured data (SPEC §14): built from our own data above, not user input. */}
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <div className="mx-auto flex max-w-content flex-col gap-10 px-4 pt-6 pb-28 md:px-8 md:pt-10 md:pb-28 lg:pb-10">
        <div className="-mb-4 flex flex-col gap-2">
          <BackButton fallbackHref="/" className="min-h-11" />
          <Breadcrumbs items={product.breadcrumbs} current={product.name} />
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            {/* Every fixture image is null for now, so this renders the category placeholder icon.
                Once products have real images, thumbnails go in a row below this box (max 10, SPEC
                §5.6) and this becomes the selected image with a next/image `priority` on the first. */}
            {/* <div className="relative aspect-square overflow-hidden rounded-xl border border-concrete-150 bg-concrete-50">
              <div className="flex size-full items-center justify-center">
                <ProductImage
                  imageKey={product.images[0]?.key ?? null}
                  alt={product.images[0]?.alt ?? product.name}
                  sizes="(min-width: 1024px) 640px, 100vw"
                  placeholderHint={product.category.slug}
                  placeholderSize={96}
                  placeholderClassName="lg:size-[160px]"
                  preload
                />
              </div>
            </div> */}
            <ProductImageGallery product={product} />
          </div>

          <div className="lg:col-span-5">
            <ProductPurchasePanel
              product={product}
              whatsapp={settings.whatsapp}
              className="lg:sticky lg:top-24"
            />
          </div>
        </div>

        {product.specifications.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="type-h2">Specifications</h2>
            <div className={cn(CARD_CLASS, "overflow-hidden")}>
              <table className="w-full text-sm">
                <tbody>
                  {product.specifications.map((spec) => (
                    <tr
                      key={spec.label}
                      className="border-b border-concrete-150 last:border-b-0"
                    >
                      <th
                        scope="row"
                        className="w-2/5 px-4 py-3 text-left font-medium text-ink-700"
                      >
                        {spec.label}
                      </th>
                      <td className="px-4 py-3 text-ink">{spec.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-4">
          <h2 className="type-h2">Description</h2>
          <div className="flex max-w-[70ch] flex-col gap-3 text-[15px]/6 text-ink-700 [&_a]:link [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc">
            {/* Markdown headings are demoted to h3: the page already has its own h1/h2 outline, and a
                product description must not introduce a second h1 or h2 into it. */}
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ node: _node, ...props }) => (
                  <h3 className="type-h3" {...props} />
                ),
                h2: ({ node: _node, ...props }) => (
                  <h3 className="type-h3" {...props} />
                ),
                h3: ({ node: _node, ...props }) => (
                  <h3 className="type-h3" {...props} />
                ),
                h4: ({ node: _node, ...props }) => (
                  <h3 className="type-h3" {...props} />
                ),
                h5: ({ node: _node, ...props }) => (
                  <h3 className="type-h3" {...props} />
                ),
                h6: ({ node: _node, ...props }) => (
                  <h3 className="type-h3" {...props} />
                ),
              }}
            >
              {product.description}
            </ReactMarkdown>
          </div>
        </section>

        {related.length > 0 ? (
          <ProductSection title="Customers also buy">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                categoryHint={product.category.slug}
              />
            ))}
          </ProductSection>
        ) : null}
      </div>
    </>
  );
}
