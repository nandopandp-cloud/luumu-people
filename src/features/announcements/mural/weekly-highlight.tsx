"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { IconButton } from "@/design-system/components/button";
import { cn } from "@/design-system/cn";
import { CoverArt, type CoverIllustration, type CoverTheme } from "@/design-system/illustrations/cover-art";

export type WeeklySlide = { id: string; title: string; summary: string; coverFileId: string | null; theme: CoverTheme; illustration: CoverIllustration };

const BACKGROUND: Record<CoverTheme, string> = {
  purple: "bg-purple-100",
  green: "bg-green-100",
  orange: "bg-orange-100",
  blue: "bg-blue-100",
  pink: "bg-pink-100",
  yellow: "bg-yellow-100",
};

/** "Comunicado da semana": os mais engajados dos últimos 7 dias, um por vez, com setas. */
export function WeeklyHighlight({ slides }: { slides: WeeklySlide[] }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  const slide = slides[index]!;
  const go = (delta: number) => setIndex((i) => (((i + delta) % count) + count) % count);

  return (
    <section aria-labelledby="comunicado-da-semana" aria-roledescription="carrossel" className="card p-5">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 id="comunicado-da-semana" className="text-h4 font-bold text-neutral-900">
          Comunicado da semana
        </h2>
        {count > 1 ? (
          <div className="flex items-center gap-0.5">
            <IconButton label="Comunicado anterior" variant="plain" size="sm" onClick={() => go(-1)}>
              <ChevronLeft />
            </IconButton>
            <IconButton label="Próximo comunicado" variant="plain" size="sm" onClick={() => go(1)}>
              <ChevronRight />
            </IconButton>
          </div>
        ) : null}
      </header>
      <div role="group" aria-roledescription="slide" aria-label={`${index + 1} de ${count}`} className={cn("group relative isolate flex min-h-[148px] overflow-hidden rounded-lg", BACKGROUND[slide.theme])}>
        {slide.coverFileId ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API */}
            <img src={`/api/v1/files/${slide.coverFileId}`} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-white/95 via-white/80 to-white/10" />
          </>
        ) : (
          <CoverArt theme={slide.theme} illustration={slide.illustration} className="absolute inset-y-0 right-0 -z-10 w-[42%] [mask-image:linear-gradient(to_right,transparent,black_40%)]" iconClassName="size-14" />
        )}
        <div className="flex max-w-[64%] flex-col justify-center p-5">
          <h3 className="line-clamp-3 text-h4 font-extrabold leading-snug text-neutral-900">
            <Link href={`/comunicados/${slide.id}` as Route} className="after:absolute after:inset-0 group-hover:text-purple-700 focus-visible:outline-2 focus-visible:outline-purple-500">
              {slide.title}
            </Link>
          </h3>
          <p className="mt-2 line-clamp-2 text-body-sm text-neutral-700">{slide.summary}</p>
        </div>
      </div>
    </section>
  );
}
