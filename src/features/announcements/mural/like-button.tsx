"use client";

import { Heart } from "lucide-react";
import { useState, useTransition } from "react";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { api, ApiError } from "@/lib/api-client";

/** Curtir/descurtir com atualização otimista. O número sempre aparece também em texto. */
export function LikeButton({ announcementId, likes, likedByMe, className }: { announcementId: string; likes: number; likedByMe: boolean; className?: string }) {
  const toast = useToast();
  const [state, setState] = useState({ likes, likedByMe });
  const [pending, startTransition] = useTransition();

  function toggle() {
    const previous = state;
    const next = { likes: state.likes + (state.likedByMe ? -1 : 1), likedByMe: !state.likedByMe };
    setState(next);
    startTransition(async () => {
      try {
        setState(await api<typeof state>(`/api/v1/announcements/${announcementId}/like`, { method: previous.likedByMe ? "DELETE" : "POST" }));
      } catch (e) {
        setState(previous);
        toast({ tone: "error", title: "Não foi possível registrar a curtida", description: e instanceof ApiError ? e.message : "Tente novamente." });
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={state.likedByMe}
      aria-label={`${state.likedByMe ? "Descurtir" : "Curtir"} (${state.likes} ${state.likes === 1 ? "curtida" : "curtidas"})`}
      className={cn(
        "relative z-10 inline-flex items-center gap-1.5 rounded-full px-1.5 py-1 text-body-sm text-neutral-600 transition-colors hover:text-pink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
        state.likedByMe && "text-pink-700",
        className,
      )}
    >
      <Heart aria-hidden className={cn("size-[18px]", state.likedByMe ? "fill-current" : "text-pink-700")} />
      <span className="tabular-nums">{state.likes}</span>
    </button>
  );
}
