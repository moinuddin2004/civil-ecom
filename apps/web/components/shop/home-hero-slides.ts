import type { BannerDTO } from '@aricon/shared';
import type { ImageSlide, MessageSlide } from './hero-banner-carousel';

/**
 * An uploaded banner as a hero slide. Lives here, not in the carousel file: that one is a client
 * module, and the (server) home page can't call functions exported from it.
 */
export function toImageSlide(banner: BannerDTO): ImageSlide {
  return { kind: 'image', ...banner };
}

/**
 * The home hero while no banner images have been uploaded (SPEC §10.10): flat light
 * panels with the store's core promises (DESIGN.md §4.4). Uploaded banners replace them.
 */
export const DEFAULT_HERO_SLIDES: MessageSlide[] = [
  {
    kind: 'message',
    id: 'hero-bulk',
    tone: 'ink',
    eyebrow: 'Cement & plaster',
    heading: 'Buy more, pay less per bag',
    body: 'Bulk prices on OPC and PPC cement, delivered to your site across Karachi.',
    ctaLabel: 'Shop cement',
    link: '/category/cement-plaster',
  },
  {
    kind: 'message',
    id: 'hero-electrical',
    tone: 'blueprint',
    eyebrow: 'Electrical',
    heading: 'Genuine wires, switches and breakers',
    body: 'Everything for wiring a new site or a renovation, from trusted brands.',
    ctaLabel: 'Shop electrical',
    link: '/category/electrical',
  },
  {
    kind: 'message',
    id: 'hero-payment',
    tone: 'ink-700',
    eyebrow: 'Ordering made easy',
    heading: 'Cash on delivery or bank transfer',
    body: 'No online payment needed — pay when your order arrives, or transfer and upload your receipt.',
    ctaLabel: 'Start shopping',
    link: null,
  },
];
