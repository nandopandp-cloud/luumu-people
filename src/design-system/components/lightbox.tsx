"use client";

import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import type { KeyboardEvent } from "react";
import { cn } from "../cn";

/**
 * Lightbox — visualiza imagens ampliadas e documentos (cartão com nome e
 * tamanho), com Baixar, Abrir em nova aba e navegação entre os arquivos
 * (setas na tela e ← → no teclado). Radix Dialog: foco preso, Esc fecha.
 */
export type LightboxItem = {
  id: string;
  name: string;
  mimeType: string;
  /** Endereço para exibir (inline). */
  url: string;
  /** Endereço que entrega o arquivo como anexo (baixar). */
  downloadUrl: string;
  /** Linha de apoio: tamanho, quem enviou, quando. */
  caption?: string;
};

export function Lightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: LightboxItem[];
  /** Arquivo aberto; `null` fecha. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const item = index !== null ? items[index] : undefined;
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < items.length - 1;
  const isImage = item?.mimeType.startsWith("image/");

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" && hasPrev) onIndexChange(index! - 1);
    if (e.key === "ArrowRight" && hasNext) onIndexChange(index! + 1);
  };

  const control = "inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-body-sm font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [&_svg]:size-[18px]";
  const arrow =
    "absolute top-1/2 z-10 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-0 [&_svg]:size-6";

  return (
    <RadixDialog.Root open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-neutral-900/90 backdrop-blur-sm" />
        <RadixDialog.Content onKeyDown={onKeyDown} className="fixed inset-0 z-50 flex flex-col focus:outline-none" aria-describedby={item?.caption ? "lightbox-legenda" : undefined}>
          {item ? (
            <>
              <header className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
                <div className="min-w-0 flex-1">
                  <RadixDialog.Title className="truncate text-body font-semibold text-white">{item.name}</RadixDialog.Title>
                  <p id="lightbox-legenda" className="truncate text-caption text-white/75">
                    {items.length > 1 ? `${index! + 1} de ${items.length}` : null}
                    {items.length > 1 && item.caption ? " · " : null}
                    {item.caption}
                  </p>
                </div>
                <a href={item.downloadUrl} download={item.name} className={control}>
                  <Download aria-hidden /> Baixar
                </a>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className={cn(control, "max-sm:hidden")}>
                  <ExternalLink aria-hidden /> Abrir em nova aba
                </a>
                <RadixDialog.Close className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white" aria-label="Fechar">
                  <X className="size-5" />
                </RadixDialog.Close>
              </header>
              <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-20">
                <button type="button" className={cn(arrow, "left-3 sm:left-6")} onClick={() => onIndexChange(index! - 1)} disabled={!hasPrev} aria-label="Arquivo anterior">
                  <ChevronLeft />
                </button>
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API
                  <img key={item.id} src={item.url} alt={item.name} className="max-h-full max-w-full rounded-lg object-contain shadow-lg" />
                ) : (
                  <div key={item.id} className="flex w-full max-w-sm flex-col items-center rounded-xl bg-white p-8 text-center shadow-lg">
                    <span aria-hidden className="flex size-20 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                      <FileText className="size-10" />
                    </span>
                    <p className="mt-4 break-all text-body font-semibold text-neutral-900">{item.name}</p>
                    {item.caption ? <p className="mt-1 text-body-sm text-neutral-600">{item.caption}</p> : null}
                    <div className="mt-6 flex w-full flex-col gap-2">
                      <a
                        href={item.downloadUrl}
                        download={item.name}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-purple-500 px-5 text-body-sm font-semibold text-white hover:bg-purple-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
                      >
                        <Download aria-hidden className="size-[18px]" /> Baixar arquivo
                      </a>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-purple-300 px-5 text-body-sm font-semibold text-purple-600 hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
                      >
                        <ExternalLink aria-hidden className="size-[18px]" /> Abrir em nova aba
                      </a>
                    </div>
                  </div>
                )}
                <button type="button" className={cn(arrow, "right-3 sm:right-6")} onClick={() => onIndexChange(index! + 1)} disabled={!hasNext} aria-label="Próximo arquivo">
                  <ChevronRight />
                </button>
              </div>
            </>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
