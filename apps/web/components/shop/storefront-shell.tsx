import type { ReactNode } from 'react';
import { getCategories, getDeliveryAreas, getPublicSettings } from '@/lib/api-server';
import { Footer } from './footer';
import { Header } from './header';
import { WhatsAppButton } from './whatsapp-button';

/**
 * Storefront chrome shared by the shop and the account section: header (categories, search, area,
 * account, cart), footer and the floating WhatsApp button. The reads come from the Next.js data
 * cache (300 s + tags), so wrapping a page in it costs no extra API calls.
 */
export async function StorefrontShell({ children }: { children: ReactNode }) {
  const [categories, areas, settings] = await Promise.all([getCategories(), getDeliveryAreas(), getPublicSettings()]);

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <Header categories={categories} areas={areas} whatsapp={settings.whatsapp} phone={settings.phone} />
      <main className="flex-1">{children}</main>
      <Footer categories={categories} settings={settings} />
      <WhatsAppButton phone={settings.whatsapp} message="Hi, I have a question about an order." />
    </div>
  );
}
