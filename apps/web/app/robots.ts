import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

/** `/robots.txt` (SPEC §14): private and per-visitor pages stay out of search results. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/checkout', '/cart', '/search'] }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
