import type { Metadata, Viewport } from 'next';
import { Barlow_Semi_Condensed, Noto_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/toaster';
import { getCurrentCustomer } from '@/lib/api-server';
import { SITE_NAME, siteUrl } from '@/lib/site';
import './globals.css';

// Self-hosted at build time by next/font: no request to Google from the visitor's browser.
const display = Barlow_Semi_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
});

const sans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE_NAME}: construction materials delivered in Karachi`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Cement, wiring, pipes and hardware from genuine brands at bulk prices, delivered across Karachi. Pay cash on delivery or by bank transfer.',
  applicationName: SITE_NAME,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1e2a32',
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // The signed-in customer for the header and cart (null for guests; no request without a session cookie).
  const customer = await getCurrentCustomer();
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh">
        <Providers customer={customer}>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
