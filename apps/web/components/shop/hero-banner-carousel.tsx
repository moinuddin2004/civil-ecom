'use client';

import type { BannerDTO } from '@aricon/shared';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { staticImageSrc } from '@/lib/images';
import { cn } from '@/lib/utils';

/** A text slide on a flat ink/blueprint panel (DESIGN.md §4.4) — used until banners are uploaded. */
export interface MessageSlide {
  kind: 'message';
  id: string;
  eyebrow: string;
  heading: string;
  body: string;
  ctaLabel: string;
  link: string | null;
  tone: 'ink' | 'blueprint' | 'ink-700';
}

/** An uploaded banner (SPEC §5.13): desktop 1600×500, optional mobile 800×600. */
export interface ImageSlide extends BannerDTO {
  kind: 'image';
}

export type HeroSlide = MessageSlide | ImageSlide;

const TONE_CLASS: Record<MessageSlide['tone'], string> = {
  ink: 'bg-amber-100',
  blueprint: 'bg-blueprint-50',
  'ink-700': 'bg-concrete-100',
};

/**
 * Home hero (SPEC §8.3, DESIGN.md §8.2): auto-advances every 6 s, pauses on touch/hover and
 * respects `prefers-reduced-motion` (SPEC §15 — the only auto-playing motion allowed).
 */
export function HeroBannerCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % slides.length), 6000);
    return () => clearInterval(timer);
  }, [slides.length, paused]);

  const slide = slides[index];
  if (!slide) return null;

  function goTo(next: number) {
    setIndex(((next % slides.length) + slides.length) % slides.length);
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured"
      className={cn(
        'relative overflow-hidden rounded-2xl md:rounded-3xl',
        slide.kind === 'message' ? cn('px-5 py-8 text-ink md:px-14 md:py-14', TONE_CLASS[slide.tone]) : 'bg-ink text-white',
      )}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onTouchStart={(event) => {
        setPaused(true);
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        const end = event.changedTouches[0]?.clientX;
        if (start !== null && end !== undefined) {
          const delta = end - start;
          if (delta > 40) goTo(index - 1);
          else if (delta < -40) goTo(index + 1);
        }
        touchStartX.current = null;
      }}
    >
      <div aria-live="polite">{slide.kind === 'message' ? <MessageSlideContent slide={slide} /> : <ImageSlideContent slide={slide} />}</div>

      {slides.length > 1 ? (
        <div
          className={cn('flex gap-2', slide.kind === 'message' ? 'mt-8' : 'absolute bottom-4 left-5 md:left-8')}
          role="tablist"
          aria-label="Banners"
        >
          {slides.map((item, dotIndex) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={dotIndex === index}
              aria-label={`Show banner ${dotIndex + 1} of ${slides.length}`}
              onClick={() => goTo(dotIndex)}
              className={cn('h-1.5 rounded-full transition-[width]', dotIndex === index ? 'w-6 bg-amber' : cn('w-1.5', slide.kind === 'message' ? 'bg-ink/25' : 'bg-white/40'))}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MessageSlideContent({ slide }: { slide: MessageSlide }) {
  return (
    <div className="max-w-[36ch] md:max-w-[44ch]">
      <p className="text-sm font-semibold text-ink-700">{slide.eyebrow}</p>
      <h1 className="mt-2 type-display">{slide.heading}</h1>
      <p className="mt-3 max-w-[44ch] text-ink-700">{slide.body}</p>
      <Button asChild size="lg" className="mt-6">
        <Link href={slide.link ?? '/search'}>{slide.ctaLabel}</Link>
      </Button>
    </div>
  );
}

/** Desktop and mobile images are separate files (art direction), so each has its own `Image`. */
function ImageSlideContent({ slide }: { slide: ImageSlide }) {
  const images = (
    <>
      <Image
        src={staticImageSrc(slide.desktopKey)}
        alt={slide.alt}
        width={1600}
        height={500}
        priority
        sizes="(min-width: 1280px) 1216px, 100vw"
        className={cn('h-auto w-full', slide.mobileKey && 'hidden md:block')}
      />
      {slide.mobileKey ? (
        <Image
          src={staticImageSrc(slide.mobileKey)}
          alt={slide.alt}
          width={800}
          height={600}
          priority
          sizes="100vw"
          className="h-auto w-full md:hidden"
        />
      ) : null}
    </>
  );
  if (!slide.link) return images;
  const external = slide.link.startsWith('https://');
  return external ? (
    <a href={slide.link} target="_blank" rel="noopener noreferrer" className="block">
      {images}
    </a>
  ) : (
    <Link href={slide.link} className="block">
      {images}
    </Link>
  );
}
