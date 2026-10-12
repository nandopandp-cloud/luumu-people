"use client";

import { Heart } from "lucide-react";
import { Popover } from "radix-ui";
import { useState, useTransition } from "react";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { api, ApiError } from "@/lib/api-client";
import { MoodArt } from "@/features/wellbeing/mood-art";

export type ReactionKind = "love" | "cheer" | "sad";
export type ReactionState = { counts: Record<ReactionKind, number>; mine: ReactionKind | null };

/** Reações do mural: o coração e o Luumu feliz e triste (mesmas ameixas do sentimento do dia). */
export const REACTIONS: { kind: ReactionKind; label: string }[] = [
  { kind: "love", label: "Amei" },
  { kind: "cheer", label: "Que demais!" },
  { kind: "sad", label: "Que pena" },
];

function ReactionIcon({ kind, className }: { kind: ReactionKind; className?: string }) {
  if (kind === "love") return <Heart aria-hidden className={cn("fill-red-500 text-red-500", className)} />;
  return <MoodArt slug={kind === "cheer" ? "muito-bem" : "mal"} className={className} />;
}

const total = (s: ReactionState) => s.counts.love + s.counts.cheer + s.counts.sad;
const plural = (n: number) => `${n} ${n === 1 ? "reação" : "reações"}`;

/** Estado otimista: troca, adiciona ou remove a reação da pessoa. */
function toggle(state: ReactionState, kind: ReactionKind): ReactionState {
  const counts = { ...state.counts };
  if (state.mine) counts[state.mine] -= 1;
  const mine = state.mine === kind ? null : kind;
  if (mine) counts[mine] += 1;
  return { counts, mine };
}

function useReactions(announcementId: string, initial: ReactionState) {
  const toast = useToast();
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();

  function react(kind: ReactionKind) {
    const previous = state;
    const next = toggle(state, kind);
    setState(next);
    startTransition(async () => {
      try {
        const saved = await api<ReactionState & { total: number }>(`/api/v1/announcements/${announcementId}/reaction`, next.mine ? { method: "PUT", body: { kind: next.mine } } : { method: "DELETE" });
        setState({ counts: saved.counts, mine: saved.mine });
      } catch (e) {
        setState(previous);
        toast({ tone: "error", title: "Não foi possível registrar a reação", description: e instanceof ApiError ? e.message : "Tente novamente." });
      }
    });
  }
  return { state, react, pending };
}

/** Página do comunicado: as três reações lado a lado, com a contagem de cada uma. */
export function ReactionBar({ announcementId, initial }: { announcementId: string; initial: ReactionState }) {
  const { state, react } = useReactions(announcementId, initial);
  return (
    <div role="group" aria-label={`Reações: ${plural(total(state))}`} className="flex flex-wrap items-center gap-2">
      {REACTIONS.map(({ kind, label }) => {
        const active = state.mine === kind;
        return (
          <button
            key={kind}
            type="button"
            onClick={() => react(kind)}
            aria-pressed={active}
            aria-label={`${label} (${state.counts[kind]})`}
            title={label}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border pl-1.5 pr-3.5 text-body-sm font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
              active ? "border-purple-300 bg-purple-50 text-purple-700" : "border-line bg-white text-neutral-700 hover:border-purple-200 hover:bg-purple-50",
            )}
          >
            <span className="flex size-7 items-center justify-center">
              <ReactionIcon kind={kind} className={kind === "love" ? "size-[18px]" : "size-7"} />
            </span>
            {state.counts[kind]}
          </button>
        );
      })}
    </div>
  );
}

/** Cartões do mural: ícones das reações recebidas + total; ao clicar, abre as três opções. */
export function ReactionPicker({ announcementId, initial, className }: { announcementId: string; initial: ReactionState; className?: string }) {
  const { state, react } = useReactions(announcementId, initial);
  const [open, setOpen] = useState(false);
  const present = REACTIONS.filter((r) => state.counts[r.kind] > 0);
  const mine = REACTIONS.find((r) => r.kind === state.mine);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        type="button"
        aria-label={`${mine ? `Sua reação: ${mine.label}` : "Reagir"} (${plural(total(state))})`}
        className={cn(
          "relative z-10 inline-flex items-center gap-1.5 rounded-full px-1.5 py-1 text-body-sm text-neutral-600 transition-colors hover:text-purple-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 data-[state=open]:text-purple-700",
          mine && "font-semibold text-purple-700",
          className,
        )}
      >
        {present.length ? (
          <span className="flex -space-x-1.5">
            {present.map((r) => (
              <span key={r.kind} className="flex size-6 items-center justify-center rounded-full bg-white ring-2 ring-white">
                <ReactionIcon kind={r.kind} className={r.kind === "love" ? "size-4" : "size-6"} />
              </span>
            ))}
          </span>
        ) : (
          <Heart aria-hidden className="size-[18px] text-pink-700" />
        )}
        <span className="tabular-nums">{total(state)}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" align="start" sideOffset={6} collisionPadding={12} aria-label="Reações" className="z-50 flex gap-1 rounded-full border border-line bg-white p-1.5 shadow-lg">
          {REACTIONS.map(({ kind, label }) => {
            const active = state.mine === kind;
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={active}
                aria-label={`${label} (${state.counts[kind]})`}
                title={label}
                onClick={() => {
                  react(kind);
                  setOpen(false);
                }}
                className={cn(
                  "flex size-11 items-center justify-center rounded-full transition-[transform,background-color] hover:-translate-y-0.5 hover:scale-110 focus-visible:outline-2 focus-visible:outline-purple-500",
                  active ? "bg-purple-100" : "hover:bg-purple-50",
                )}
              >
                <ReactionIcon kind={kind} className={kind === "love" ? "size-6" : "size-10"} />
              </button>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
