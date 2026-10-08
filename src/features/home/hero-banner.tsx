"use client";

import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Pause, Play } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/design-system/components/button";
import { cn } from "@/design-system/cn";
import { CoverArt, type CoverIllustration, type CoverTheme } from "@/design-system/illustrations/cover-art";
import { JourneySignpost } from "@/design-system/illustrations/journey-signpost";

export type BannerSlide = {
  id: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  theme: CoverTheme;
  illustration: CoverIllustration | null;
  imageFileId: string | null;
};

const BACKGROUND: Record<CoverTheme, string> = {
  purple: "from-purple-50 via-purple-100 to-purple-200",
  green: "from-green-50 via-green-100 to-green-100",
  orange: "from-orange-50 via-orange-100 to-orange-100",
  blue: "from-blue-50 via-blue-100 to-blue-100",
  pink: "from-pink-50 via-pink-100 to-pink-100",
  yellow: "from-yellow-100 via-yellow-100 to-orange-100",
};

const ROTATE_MS = 7000;

/** Um banner da home. Também usado na prévia ao vivo do editor. */
export function BannerView({ banner, greeting, imagePreviewUrl }: { banner: BannerSlide; greeting?: string; imagePreviewUrl?: string | null }) {
  const image = imagePreviewUrl ?? (banner.imageFileId ? `/api/v1/files/${banner.imageFileId}` : null);
  const external = banner.ctaUrl?.startsWith("https://");
  return (
    <div className={cn("relative h-full overflow-hidden rounded-[28px] bg-gradient-to-br", BACKGROUND[banner.theme])}>
      <svg aria-hidden viewBox="0 0 800 320" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <path d="M380 0c60 90 30 160 120 210s190 20 300 110V0Z" fill="#ffffff" opacity="0.25" />
      </svg>
      <div className="relative grid h-full items-end md:grid-cols-[minmax(0,1.12fr)_minmax(240px,0.88fr)]">
        <div className="px-7 py-8 sm:px-9">
          {greeting ? (
            <p className="text-[17px] font-semibold text-neutral-800">
              {greeting} <span aria-hidden>👋</span>
            </p>
          ) : null}
          <h2 className="mt-3 max-w-[28rem] text-balance text-[1.9rem] font-extrabold leading-[1.08] tracking-[-0.035em] text-neutral-900 sm:text-[2.1rem]">{banner.title}</h2>
          {banner.subtitle ? <p className="mt-4 max-w-[28rem] text-[15px] leading-relaxed text-neutral-700">{banner.subtitle}</p> : null}
          {banner.ctaLabel && banner.ctaUrl ? (
            <Button asChild size="lg" className="mt-6 h-11 px-7">
              {external ? (
                <a href={banner.ctaUrl} target="_blank" rel="noopener noreferrer">
                  {banner.ctaLabel} <ExternalLink aria-hidden />
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              ) : (
                <Link href={banner.ctaUrl as Route}>
                  {banner.ctaLabel} <ArrowRight aria-hidden />
                </Link>
              )}
            </Button>
          ) : null}
        </div>
        <div className="hidden h-full max-h-[300px] items-end justify-center self-stretch md:flex">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API
            <img src={image} alt="" className="h-full max-h-[300px] w-full rounded-tl-[28px] object-cover" />
          ) : banner.illustration ? (
            <CoverArt theme={banner.theme} illustration={banner.illustration} className="m-6 h-[220px] w-full max-w-[300px] rounded-[24px]" iconClassName="size-24" />
          ) : (
            <JourneySignpost className="h-full max-h-[300px] w-full" />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Carrossel de banners da home. Gira sozinho a cada 7 s, pausa ao passar o
 * mouse ou focar, tem pausa explícita (WCAG 2.2.2) e não gira com
 * "reduzir movimento".
 */
export function HeroCarousel({ slides, greeting }: { slides: BannerSlide[]; greeting: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Anima só nas trocas de slide (a primeira exibição já aparece pronta).
  const [rotated, setRotated] = useState(false);
  const count = slides.length;
  const go = useCallback(
    (next: number) => {
      setRotated(true);
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || hovering || reducedMotion) return;
    const timer = window.setTimeout(() => go(index + 1), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [count, index, paused, hovering, reducedMotion, go]);

  const slide = slides[index]!;
  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques"
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setHovering(true)}
      onBlurCapture={() => setHovering(false)}
      onKeyDown={(e) => {
        if (count < 2) return;
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      <div key={slide.id} role="group" aria-roledescription="slide" aria-label={`${index + 1} de ${count}`} className={cn("min-h-[300px]", rotated && "animate-fade-in")}>
        <BannerView banner={slide} greeting={greeting} />
      </div>
      {count > 1 ? (
        <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-white/85 px-2 py-1.5 shadow-sm backdrop-blur">
          <button type="button" onClick={() => go(index - 1)} aria-label="Banner anterior" className="flex size-7 items-center justify-center rounded-full text-neutral-700 hover:bg-purple-50 hover:text-purple-600">
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Ir para o banner ${i + 1}: ${s.title}`}
              aria-current={i === index ? "true" : undefined}
              className="group/dot flex h-7 min-w-6 items-center justify-center rounded-full"
            >
              <span aria-hidden className={cn("h-2 rounded-full transition-all", i === index ? "w-5 bg-purple-500" : "w-2 bg-neutral-300 group-hover/dot:bg-purple-300")} />
            </button>
          ))}
          <button type="button" onClick={() => go(index + 1)} aria-label="Próximo banner" className="flex size-7 items-center justify-center rounded-full text-neutral-700 hover:bg-purple-50 hover:text-purple-600">
            <ChevronRight aria-hidden className="size-4" />
          </button>
          {!reducedMotion ? (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Retomar troca automática" : "Pausar troca automática"}
              className="flex size-7 items-center justify-center rounded-full text-neutral-700 hover:bg-purple-50 hover:text-purple-600"
            >
              {paused ? <Play aria-hidden className="size-3.5" /> : <Pause aria-hidden className="size-3.5" />}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
