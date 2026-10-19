import { MessageCircle } from 'lucide-react';
import { iconProps } from './styles';

export interface WhatsAppButtonProps {
  /** E.164, e.g. `+923001234567`. */
  phone: string;
  message?: string;
}

/**
 * Floating WhatsApp button (SPEC §8.2): round on mobile, with a label from `lg`. Sits above any
 * mobile sticky bar — it shares the same offset the toaster uses (`--toast-mobile-bottom` in
 * `globals.css`, set by a page's `data-mobile-sticky-bar` element).
 */
export function WhatsAppButton({ phone, message }: WhatsAppButtonProps) {
  const href = `https://wa.me/${phone.replace(/\D/g, '')}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      style={{ bottom: 'var(--toast-mobile-bottom)' }}
      className="fixed right-4 z-20 flex h-14 items-center gap-2 rounded-full bg-success pr-5 pl-3.5 font-medium text-white shadow-float transition-transform hover:-translate-y-0.5 lg:pr-6"
    >
      <MessageCircle {...iconProps} className="size-6 shrink-0" />
      <span className="hidden lg:inline">Chat on WhatsApp</span>
    </a>
  );
}
