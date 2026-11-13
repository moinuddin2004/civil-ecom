import { Check, MessageCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CategoryTile, CategoryTileGrid } from '@/components/shop/category-tile';
import { HeroBannerCarousel } from '@/components/shop/hero-banner-carousel';
import { JsonLd } from '@/components/shop/json-ld';
import { DEFAULT_HERO_SLIDES, toImageSlide } from '@/components/shop/home-hero-slides';
import { ProductCard } from '@/components/shop/product-card';
import { ProductSection } from '@/components/shop/product-rail';
import { iconProps } from '@/components/shop/styles';
import { Button } from '@/components/ui/button';
import { getHome, getPublicSettings } from '@/lib/api-server';
import { routes } from '@/lib/routes';
import { absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Construction materials delivered in Karachi',
  description:
    "Cement, wiring, pipes and hardware from genuine brands at bulk prices, delivered across Karachi. Pay cash on delivery or by bank transfer.",
};

const TRUST_ITEMS = ['Genuine brands', 'Bulk prices', 'Cash on delivery'] as const;

export default async function HomePage() {
  const [home, settings] = await Promise.all([getHome(), getPublicSettings()]);
  const slides = home.banners.length > 0 ? home.banners.map(toImageSlide) : DEFAULT_HERO_SLIDES;

  return (
    <div className="mx-auto flex max-w-content flex-col gap-12 px-4 py-6 md:px-8 md:py-10">
      <JsonLd
        data={{
          '@type': 'Organization',
          name: settings.storeName,
          url: absoluteUrl(routes.home),
          telephone: settings.phone,
          email: settings.email,
          address: { '@type': 'PostalAddress', streetAddress: settings.address, addressLocality: 'Karachi', addressCountry: 'PK' },
          contactPoint: { '@type': 'ContactPoint', telephone: settings.phone, contactType: 'customer service', areaServed: 'PK' },
        }}
      />
      <JsonLd
        data={{
          '@type': 'WebSite',
          name: settings.storeName,
          url: absoluteUrl(routes.home),
          potentialAction: {
            '@type': 'SearchAction',
            target: `${absoluteUrl('/search')}?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        }}
      />
      <HeroBannerCarousel slides={slides} />

      <ul className="-mx-4 flex gap-5 overflow-x-auto px-4 scrollbar-none md:mx-0 md:justify-center md:px-0">
        {TRUST_ITEMS.map((label) => (
          <li key={label} className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-ink-700">
            <Check {...iconProps} className="size-4 text-success" />
            {label}
          </li>
        ))}
      </ul>

      {home.categoryTiles.length > 0 ? (
        <section aria-labelledby="categories-heading" className="flex flex-col gap-4">
          <h2 id="categories-heading" className="type-h2">
            Shop by category
          </h2>
          <CategoryTileGrid>
            {home.categoryTiles.map((tile) => (
              <CategoryTile key={tile.id} category={tile} />
            ))}
          </CategoryTileGrid>
        </section>
      ) : null}

      {home.deals.length > 0 ? (
        <ProductSection title="Deals">
          {home.deals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </ProductSection>
      ) : null}

      {home.featured.length > 0 ? (
        <ProductSection title="Featured for your site">
          {home.featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </ProductSection>
      ) : null}

      {home.newArrivals.length > 0 ? (
        <ProductSection title="New arrivals">
          {home.newArrivals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </ProductSection>
      ) : null}

      {home.brands.length > 0 ? (
        <section aria-labelledby="brands-heading" className="flex flex-col gap-4">
          <h2 id="brands-heading" className="type-h2">
            Brands we stock
          </h2>
          <div className="flex flex-wrap gap-3">
            {home.brands.map((brand) => (
              <Link
                key={brand.id}
                href={routes.brand(brand.slug)}
                className="rounded-md border border-concrete-150 bg-surface px-4 py-2.5 text-sm font-medium text-ink-700 hover:border-concrete-400 hover:text-ink"
              >
                {brand.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col items-start gap-4 rounded-2xl bg-blueprint-50 px-6 py-8 text-ink md:flex-row md:items-center md:justify-between md:px-12">
        <div className="flex flex-col gap-1.5">
          <h2 className="type-h2 text-ink">Ordering for a whole project?</h2>
          <p className="max-w-[52ch] text-ink-700">Send us your list on WhatsApp and we&apos;ll prepare a quote.</p>
        </div>
        <Button asChild size="lg" className="w-full shrink-0 md:w-auto">
          <a
            href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle {...iconProps} />
            Chat on WhatsApp
          </a>
        </Button>
      </section>
    </div>
  );
}
