import { cn } from "../cn";

/**
 * Marca Luumu People. Os arquivos são gerados a partir do SVG oficial
 * (brand/luumu-people.svg → scripts/brand-split.mjs). Regra de marca: a folha
 * existe APENAS sobre o "ú" final — nunca adicionar folha junto ao "L".
 */

/* eslint-disable @next/next/no-img-element -- SVG estático, sem otimização necessária */

export function Wordmark({ className }: { className?: string }) {
  return <img src="/brand/wordmark.svg" alt="Luumu People" width={1371} height={441} className={cn("h-12 w-auto select-none", className)} draggable={false} />;
}

export function Logo({ className }: { className?: string }) {
  return <img src="/brand/logo.svg" alt="Luumu People" width={1889} height={556} className={cn("h-16 w-auto select-none", className)} draggable={false} />;
}

/** Mascote. Decorativo por padrão (alt vazio); informe `label` se transmitir significado. */
export function Mascot({ className, label }: { className?: string; label?: string }) {
  return <img src="/brand/mascot.svg" alt={label ?? ""} width={386} height={489} className={cn("h-24 w-auto select-none", className)} draggable={false} />;
}
