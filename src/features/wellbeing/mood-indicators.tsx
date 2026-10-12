"use client";

import { SmilePlus } from "lucide-react";
import { Tooltip as RadixTooltip } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/design-system/cn";
import { moodOf, moodSentence, type Mood } from "@/lib/moods";
import { moodTime, openMoodDialog, type TodayMoodView } from "./events";
import { MoodArt } from "./mood-art";

/** Detalhes do sentimento (cartão do hover): ameixa, frase, horário e comentário. */
export function MoodDetails({ mood, at, note, who = "you" }: { mood: Mood; at: string | null; note: string | null; who?: "you" | "they" }) {
  return (
    <div className="flex gap-3 text-left">
      <MoodArt slug={mood.slug} className="size-12 shrink-0" />
      <div className="min-w-0">
        <p className="text-body-sm font-semibold text-neutral-900">
          {moodSentence(mood, who)} <span aria-hidden>💜</span>
        </p>
        {at ? <p className="mt-0.5 text-caption text-neutral-600">Registrado às {moodTime(at)}</p> : null}
        {note ? <p className="mt-2.5 rounded-lg bg-purple-50 px-3 py-2 text-caption italic leading-relaxed text-neutral-700">“{note}”</p> : null}
      </div>
    </div>
  );
}

function HoverCard({ content, children, side = "bottom", align = "center" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "right"; align?: "start" | "center" | "end" }) {
  return (
    <RadixTooltip.Provider delayDuration={150}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content side={side} align={align} sideOffset={10} collisionPadding={12} className="z-50 w-[288px] rounded-xl border border-line bg-white p-4 shadow-lg">
            {content}
            <RadixTooltip.Arrow className="fill-white drop-shadow-[0_1px_0_var(--color-line)]" width={14} height={7} />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

/** Selo discreto sobre o avatar no topo: mostra o sentimento de hoje e abre o modal. */
export function MoodTopbarBadge({ today }: { today: TodayMoodView }) {
  const mood = moodOf(today.mood);
  const button = (
    <button
      type="button"
      onClick={openMoodDialog}
      aria-label={mood ? `${moodSentence(mood)} Mudar o sentimento de hoje` : "Como você está se sentindo hoje? Registrar"}
      className="absolute left-[30px] top-[31px] z-10 flex size-[26px] items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
    >
      {mood ? <MoodArt slug={mood.slug} className="size-[26px]" /> : <SmilePlus aria-hidden className="size-4 text-purple-600" />}
    </button>
  );
  return (
    <HoverCard
      align="end"
      content={
        mood ? (
          <MoodDetails mood={mood} at={today.at} note={today.note} />
        ) : (
          <p className="text-body-sm text-neutral-700">Como você está se sentindo hoje? Clique para contar.</p>
        )
      }
    >
      {button}
    </HoverCard>
  );
}

/** Chip "Hoje você está se sentindo bem! 💜" (saudação da home e menu lateral). Abre o modal. */
export function MoodChip({ today, className, compact }: { today: TodayMoodView; className?: string; compact?: boolean }) {
  const mood = moodOf(today.mood);
  return (
    <HoverCard side={compact ? "right" : "bottom"} content={mood ? <MoodDetails mood={mood} at={today.at} note={today.note} /> : <p className="text-body-sm text-neutral-700">Conte como você está hoje.</p>}>
      <button
        type="button"
        onClick={openMoodDialog}
        aria-label={mood ? `${moodSentence(mood)} Mudar o sentimento de hoje` : "Como você está se sentindo hoje? Registrar"}
        className={cn(
          "group flex items-center gap-2.5 rounded-xl text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
          compact ? "w-full bg-purple-50 p-2 hover:bg-purple-100/70" : "border border-white/80 bg-white/85 px-3 py-2 shadow-sm backdrop-blur hover:bg-white",
          className,
        )}
      >
        <MoodArt slug={mood?.slug ?? "ola"} className={cn("shrink-0 transition-transform group-hover:scale-105", compact ? "size-10" : "size-11")} />
        <span className={cn("text-caption font-semibold leading-snug text-purple-700", compact && "sidebar-collapsed:hidden")}>
          {mood ? (
            <>
              {moodSentence(mood)} <span aria-hidden>💜</span>
            </>
          ) : (
            "Como você está hoje?"
          )}
        </span>
      </button>
    </HoverCard>
  );
}

/** Pílula com o sentimento (perfil e listas de pessoas). Somente leitura; detalhes no hover. */
export function MoodPill({ today, who = "they", className }: { today: { mood: number; at: string | null; note: string | null }; who?: "you" | "they"; className?: string }) {
  const mood = moodOf(today.mood);
  if (!mood) return null;
  const pill = (
    <span tabIndex={0} className={cn("inline-flex items-center gap-1.5 rounded-full bg-purple-50 py-1 pl-1 pr-3 text-caption font-semibold text-purple-700 focus-visible:outline-2 focus-visible:outline-purple-500", className)}>
      <MoodArt slug={mood.slug} className="size-6" />
      {moodSentence(mood, who)}
    </span>
  );
  return <HoverCard content={<MoodDetails mood={mood} at={today.at} note={today.note} who={who} />}>{pill}</HoverCard>;
}

/** Ameixa no canto do avatar do perfil (abre o modal para mudar o sentimento de hoje). */
export function MoodAvatarBadge({ today }: { today: TodayMoodView }) {
  const mood = moodOf(today.mood);
  if (!mood) return null;
  return (
    <HoverCard content={<MoodDetails mood={mood} at={today.at} note={today.note} />}>
      <button
        type="button"
        onClick={openMoodDialog}
        aria-label={`${moodSentence(mood)} Mudar o sentimento de hoje`}
        className="absolute -right-1 top-1 flex size-11 items-center justify-center rounded-full bg-white shadow-md ring-4 ring-white transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
      >
        <MoodArt slug={mood.slug} className="size-11" />
      </button>
    </HoverCard>
  );
}
