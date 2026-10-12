"use client";

import { useEffect } from "react";

const EVERY_MS = 60_000;

/**
 * Sinal de presença ("online agora" para amigos e quem conversa com a pessoa):
 * só com a aba visível, a cada minuto e ao voltar para a janela.
 */
export function PresenceBeacon() {
  useEffect(() => {
    let last = 0;
    const beat = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 30_000) return;
      last = Date.now();
      void fetch("/api/v1/me/presence", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    };
    beat();
    const timer = window.setInterval(beat, EVERY_MS);
    document.addEventListener("visibilitychange", beat);
    window.addEventListener("focus", beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
      window.removeEventListener("focus", beat);
    };
  }, []);
  return null;
}
