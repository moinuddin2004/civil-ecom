import type { CategoryNode, PublicSettingsDTO } from '@aricon/shared';
import { Mail, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';
import { routes } from '@/lib/routes';
import { iconProps } from './styles';

export interface FooterProps {
  categories: CategoryNode[];
  settings: PublicSettingsDTO;
}

/** Global storefront footer (SPEC §8.2, DESIGN.md §8.1). */
export function Footer({ categories, settings }: FooterProps) {
  return (
    <footer className="border-t border-concrete-150 bg-concrete-50 px-5 py-8 text-ink-700 md:px-12 md:py-10">
      <div className="mx-auto flex max-w-content flex-col gap-8 md:gap-10">
        <div className="flex flex-col gap-2">
          <span className="flex items-baseline gap-1.5 font-display text-ink">
            <span className="text-xl font-bold tracking-wordmark">ARICON</span>
            <span className="text-lg font-medium text-cement">Shop</span>
          </span>
          <p className="max-w-[52ch] text-sm">
            Aricon Shop is run by Aricon Engineering Consultants, Karachi.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <div className="flex flex-col gap-2.5">
            <h2 className="text-sm font-semibold text-ink">Shop</h2>
            {categories.slice(0, 6).map((category) => (
              <Link key={category.id} href={routes.category(category.slug)} className="text-sm hover:text-ink">
                {category.name}
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            <h2 className="text-sm font-semibold text-ink">Help</h2>
            <Link href={routes.trackOrder} className="text-sm hover:text-ink">
              Track your order
            </Link>
            <Link href={routes.page('faq')} className="text-sm hover:text-ink">
              FAQ
            </Link>
            <Link href={routes.page('deliveryPolicy')} className="text-sm hover:text-ink">
              Delivery policy
            </Link>
            <Link href={routes.page('refundPolicy')} className="text-sm hover:text-ink">
              Refund policy
            </Link>
            <Link href={routes.page('contact')} className="text-sm hover:text-ink">
              Contact
            </Link>
          </div>

          <div className="flex flex-col gap-2.5">
            <h2 className="text-sm font-semibold text-ink">Company</h2>
            <Link href={routes.page('about')} className="text-sm hover:text-ink">
              About
            </Link>
            <Link href={routes.page('terms')} className="text-sm hover:text-ink">
              Terms and conditions
            </Link>
            <Link href={routes.page('privacyPolicy')} className="text-sm hover:text-ink">
              Privacy policy
            </Link>
          </div>

          <div className="col-span-2 flex flex-col gap-2.5 md:col-span-1">
            <h2 className="text-sm font-semibold text-ink">Contact</h2>
            <a href={`tel:${settings.phone.replace(/\s+/g, '')}`} className="flex items-start gap-2 text-sm hover:text-ink">
              <Phone {...iconProps} className="mt-0.5 size-4 shrink-0" />
              {settings.phone}
            </a>
            <a href={`mailto:${settings.email}`} className="flex items-start gap-2 text-sm hover:text-ink">
              <Mail {...iconProps} className="mt-0.5 size-4 shrink-0" />
              {settings.email}
            </a>
            <p className="flex items-start gap-2 text-sm">
              <MapPin {...iconProps} className="mt-0.5 size-4 shrink-0" />
              {settings.address}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-concrete-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-cement">
            &copy; {new Date().getFullYear()} Aricon Engineering Consultants. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={routes.adminLogin()}
              rel="nofollow"
              className="mr-2 inline-flex min-h-11 items-center text-xs text-cement hover:text-ink"
            >
              Staff login
            </Link>
            {settings.paymentMethods.cod ? (
              <span className="rounded-full bg-concrete-150 px-2.5 py-1 text-xs font-medium text-ink-700">Cash on delivery</span>
            ) : null}
            {settings.paymentMethods.bankTransfer ? (
              <span className="rounded-full bg-concrete-150 px-2.5 py-1 text-xs font-medium text-ink-700">Bank transfer</span>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
