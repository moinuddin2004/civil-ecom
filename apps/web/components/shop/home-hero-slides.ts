import type { MessageSlide } from './hero-banner-carousel';

/**
 * The home hero while no banner images have been uploaded (SPEC §10.10): flat ink/blueprint
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
