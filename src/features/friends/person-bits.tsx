"use client";

import { Avatar } from "@/design-system/components/avatar";
import { Tooltip } from "@/design-system/components/tooltip";
import { cn } from "@/design-system/cn";
import { moodOf, moodSentence } from "@/lib/moods";
import { MoodArt } from "@/features/wellbeing/mood-art";
import type { MoodView } from "./types";

const TZ = "America/Sao_Paulo";
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** 10:24 */
export function timeOf(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
}

function daysAgo(iso: string, now = new Date()) {
  const a = new Date(`${dayKey(new Date(iso))}T12:00:00Z`).getTime();
  const b = new Date(`${dayKey(now)}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Lista de conversas: hora (hoje), "Ontem", dia da semana (até 6 dias) ou a data. */
export function shortWhen(iso: string) {
  const days = daysAgo(iso);
  if (days <= 0) return timeOf(iso);
  if (days === 1) return "Ontem";
  if (days < 7) {
    const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: TZ }).format(new Date(iso)).replace(".", "");
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ }).format(new Date(iso));
}

/** Separador do chat: "Hoje", "Ontem" ou "segunda-feira, 12 de outubro". */
export function dayLabel(iso: string) {
  const days = daysAgo(iso);
  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(new Date(iso));
}

export const sameDay = (a: string, b: string) => dayKey(new Date(a)) === dayKey(new Date(b));

/** Avatar com o ponto verde de "online agora". */
export function PresenceAvatar({ name, image, online, size = "lg", className }: { name: string; image: string | null; online?: boolean; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Avatar name={name} src={image} size={size} className="ring-0" />
      {online ? (
        <span
          className={cn("absolute bottom-0 right-0 rounded-full bg-green-500 ring-2 ring-white", size === "xl" ? "size-6 ring-4" : size === "lg" ? "size-3.5" : "size-3")}
          role="img"
          aria-label="Online agora"
        />
      ) : null}
    </span>
  );
}

/**
 * Ameixa do sentimento de hoje ao lado do nome (detalhes no hover/foco).
 * `inline`: dentro de um botão/link (sem foco próprio nem tooltip), só a imagem com o texto alternativo.
 */
export function MoodMark({ mood, className, inline }: { mood: MoodView | null; className?: string; inline?: boolean }) {
  const m = moodOf(mood?.mood);
  if (!m || !mood) return null;
  if (inline) return <MoodArt slug={m.slug} label={moodSentence(m, "they")} className={cn("size-6 shrink-0", className)} />;
  return (
    <Tooltip content={<span className="block max-w-56">{moodSentence(m, "they")} 💜</span>}>
      <span tabIndex={0} className={cn("inline-flex shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-purple-500", className)}>
        <MoodArt slug={m.slug} label={moodSentence(m, "they")} className="size-6" />
      </span>
    </Tooltip>
  );
}

/** Pílula "Sentindo-se bem" do painel do perfil. */
export function MoodStatusPill({ mood }: { mood: MoodView | null }) {
  const m = moodOf(mood?.mood);
  if (!m || !mood) return null;
  return (
    <Tooltip content={<MoodDetailsDark mood={mood} />}>
      <span tabIndex={0} className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 py-1 pl-1 pr-3 text-caption font-semibold text-yellow-800 focus-visible:outline-2 focus-visible:outline-purple-500">
        <MoodArt slug={m.slug} className="size-6" />
        Sentindo-se {m.label.toLowerCase()}
      </span>
    </Tooltip>
  );
}

function MoodDetailsDark({ mood }: { mood: MoodView }) {
  const m = moodOf(mood.mood)!;
  return (
    <span className="block">
      {moodSentence(m, "they")} 💜 <span className="opacity-80">· {timeOf(mood.at)}</span>
      {mood.note ? <span className="mt-1 block italic opacity-90">“{mood.note}”</span> : null}
    </span>
  );
}

/** Pílula "Online agora". */
export function OnlinePill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-caption font-semibold text-green-800">
      <span aria-hidden className="size-2.5 rounded-full bg-green-500 ring-2 ring-white" />
      Online agora
    </span>
  );
}

