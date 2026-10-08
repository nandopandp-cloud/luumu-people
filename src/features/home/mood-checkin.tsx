"use client";

import { Lock } from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "@/design-system/cn";
import { api } from "@/lib/api-client";

type Mood = { value: number; label: string; emoji: string };

/**
 * "Como você está se sentindo hoje?" — registro identificado, visível apenas
 * para a própria pessoa (garantido por RLS). Pode mudar ao longo do dia.
 */
export function MoodCheckin({ moods, initial }: { moods: readonly Mood[]; initial: number | null }) {
  const [selected, setSelected] = useState<number | null>(initial);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function choose(value: number) {
    const previous = selected;
    setSelected(value);
    setError(false);
    startTransition(async () => {
      try {
        await api("/api/v1/me/mood", { method: "PUT", body: { mood: value } });
      } catch {
        setSelected(previous);
        setError(true);
      }
    });
  }

  return (
    <div>
      <div role="group" aria-label="Como você está se sentindo hoje?" className="grid grid-cols-5 gap-1 rounded-lg bg-white p-2 shadow-sm">
        {moods.map((m) => {
          const active = selected === m.value;
          return (
            <button
              key={m.value}
              type="button"
              aria-pressed={active}
              disabled={pending}
              onClick={() => choose(m.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-md px-1 py-2.5 text-center transition-[background-color,transform] focus-visible:outline-2 focus-visible:outline-purple-500",
                active ? "bg-purple-50 ring-2 ring-purple-400" : "hover:-translate-y-0.5 hover:bg-neutral-50",
              )}
            >
              <span aria-hidden className={cn("text-[30px] leading-none transition-transform", active && "scale-110")}>
                {m.emoji}
              </span>
              <span className="text-[11px] leading-tight text-neutral-600">{m.label}</span>
            </button>
          );
        })}
      </div>
      <p role="status" className="mt-3 flex items-center gap-1.5 text-caption text-neutral-600">
        {error ? (
          <span className="text-red-600">Não conseguimos salvar agora. Tente de novo.</span>
        ) : selected ? (
          <>Obrigado por compartilhar 💜</>
        ) : (
          <>
            <Lock aria-hidden className="size-3.5" /> Só você vê o seu registro.
          </>
        )}
      </p>
    </div>
  );
}
