"use client";

import { ArrowRight, Pause, Play, Star } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/design-system/components/button";
import { cn } from "@/design-system/cn";
import { CoverArt, type CoverIllustration, type CoverTheme } from "@/design-system/illustrations/cover-art";

export type FeaturedSlide = { id: string; title: string; summary: string; coverFileId: string | null; theme: CoverTheme; illustration: CoverIllustration };

const ROTATE_MS = 8000;

/**
 * Destaques do mural (comunicados fixados). Gira sozinho, pausa ao passar o
 * mouse ou focar, tem pausa explícita (WCAG 2.2.2) e não gira com "reduzir movimento".
 */
export function FeaturedCarousel({ slides }: { slides: FeaturedSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
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
      aria-label="Comunicados em destaque"
      className="mb-5"
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
      <div
        key={slide.id}
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} de ${count}`}
        className={cn("relative isolate overflow-hidden rounded-xl bg-purple-100 shadow-sm", rotated && "animate-fade-in")}
      >
        <div aria-hidden className="absolute inset-y-0 right-0 w-full md:w-[56%]">
          {slide.coverFileId ? (
            // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API
            <img src={`/api/v1/files/${slide.coverFileId}`} alt="" className="size-full object-cover" />
          ) : (
            <CoverArt theme={slide.theme} illustration={slide.illustration} className="size-full" iconClassName="size-24" />
          )}
          {/* Funde a imagem com o fundo: o texto fica sempre sobre a área lisa. */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-100 via-purple-100/80 to-transparent md:via-purple-100/30" />
        </div>
        <div className="relative max-w-[30rem] px-6 py-7 sm:px-8 sm:py-8">
          <span className="inline-flex items-center gap-1 rounded-sm bg-yellow-100 px-2 py-0.5 text-caption font-bold uppercase tracking-wide text-neutral-900">
            <Star aria-hidden className="size-3.5 fill-orange-500 text-orange-500" /> Destaque
          </span>
          <h2 className="mt-3 text-balance text-h1 font-extrabold leading-[1.1] tracking-[-0.03em] text-neutral-900">{slide.title}</h2>
          <p className="mt-3 line-clamp-3 text-body text-neutral-700">{slide.summary}</p>
          <Button asChild size="lg" className="mt-5 h-11 px-6">
            <Link href={`/comunicados/${slide.id}` as Route}>
              Saiba mais <ArrowRight aria-hidden />
              <span className="sr-only"> sobre “{slide.title}”</span>
            </Link>
          </Button>
        </div>
      </div>
      {count > 1 ? (
        <div className="mt-2.5 flex items-center justify-center gap-1">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Ir para o destaque ${i + 1}: ${s.title}`}
              aria-current={i === index ? "true" : undefined}
              className="group/dot flex h-6 min-w-5 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-purple-500"
            >
              <span aria-hidden className={cn("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-purple-500" : "w-1.5 bg-neutral-300 group-hover/dot:bg-purple-300")} />
            </button>
          ))}
          {!reducedMotion ? (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Retomar troca automática dos destaques" : "Pausar troca automática dos destaques"}
              className="ml-1 flex size-6 items-center justify-center rounded-full text-neutral-600 hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500"
            >
              {paused ? <Play aria-hidden className="size-3" /> : <Pause aria-hidden className="size-3" />}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
