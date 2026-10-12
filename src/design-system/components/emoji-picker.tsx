"use client";

import { Briefcase, Clock3, Hand, Heart, Leaf, PartyPopper, Search, Smile, type LucideIcon } from "lucide-react";
import { Popover } from "radix-ui";
import { useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { cn } from "../cn";
import { EMOJI_CATEGORIES, findEmoji, searchEmojis, type Emoji, type EmojiCategory } from "../emoji-data";

/**
 * Seletor de emojis — botão com carinha que abre o conjunto curado
 * (src/design-system/emoji-data.ts), com busca e "Recentes" (guardados só neste
 * navegador). Na grade, as setas movem o foco; Enter escolhe.
 */

type Tab = EmojiCategory | "recentes";

const RECENT_KEY = "luumu:emojis-recentes";
const RECENT_MAX = 16;
const COLUMNS = 8;

const TAB_ICON: Record<Tab, LucideIcon> = {
  recentes: Clock3,
  carinhas: Smile,
  gestos: Hand,
  celebracao: PartyPopper,
  coracoes: Heart,
  trabalho: Briefcase,
  natureza: Leaf,
};

function readRecent(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((c): c is string => typeof c === "string" && Boolean(findEmoji(c))) : [];
  } catch {
    return [];
  }
}

function saveRecent(char: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([char, ...readRecent().filter((c) => c !== char)].slice(0, RECENT_MAX)));
  } catch {
    /* sem armazenamento (janela anônima, bloqueio): segue sem recentes */
  }
}

/**
 * Insere `text` no cursor de um campo (ou no lugar da seleção) e devolve o foco a ele.
 * Usa `execCommand("insertText")`, que mantém desfazer/refazer e dispara o `onChange`
 * do React; sem ele, troca o valor e dispara o evento de input.
 */
export function insertAtCaret(el: HTMLTextAreaElement | HTMLInputElement, text: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  el.focus();
  el.setSelectionRange(start, end);
  const ok = typeof document.execCommand === "function" && document.execCommand("insertText", false, text);
  if (ok) return;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, el.value.slice(0, start) + text + el.value.slice(end));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.setSelectionRange(start + text.length, start + text.length);
}

export function EmojiPicker({
  onPick,
  label = "Inserir emoji",
  disabled,
  className,
  align = "end",
}: {
  onPick: (emoji: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("carinhas");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const picked = useRef(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    const list = readRecent();
    picked.current = false;
    setRecent(list);
    setTab(list.length ? "recentes" : "carinhas");
    setQuery("");
  }

  function pick(emoji: Emoji) {
    picked.current = true;
    saveRecent(emoji.char);
    setOpen(false);
    onPick(emoji.char);
  }

  const tabs: { id: Tab; label: string }[] = [...(recent.length ? [{ id: "recentes" as const, label: "Recentes" }] : []), ...EMOJI_CATEGORIES];
  const results = query.trim() ? searchEmojis(query) : null;
  const emojis = results ?? (tab === "recentes" ? recent.map((c) => findEmoji(c)!) : EMOJI_CATEGORIES.find((c) => c.id === tab)!.emojis);
  const heading = results ? "Resultados" : tabs.find((t) => t.id === tab)?.label;

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-emoji]")];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS, Home: -index, End: buttons.length - 1 - index };
    if (index < 0 || !(event.key in step)) return;
    event.preventDefault();
    buttons[Math.min(buttons.length - 1, Math.max(0, index + step[event.key]!))]?.focus();
  }

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        type="button"
        disabled={disabled}
        aria-label={label}
        title={label}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500 disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-purple-50 data-[state=open]:text-purple-600",
          className,
        )}
      >
        <Smile aria-hidden className="size-5" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          aria-label="Emojis"
          // Depois de escolher, o foco fica no campo de texto (não volta ao botão).
          onCloseAutoFocus={(event) => {
            if (picked.current) event.preventDefault();
          }}
          className="z-50 w-[min(328px,calc(100vw-1.5rem))] rounded-lg border border-line bg-white p-2 shadow-lg"
        >
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results?.[0]) {
                  e.preventDefault();
                  pick(results[0]);
                }
              }}
              aria-label="Buscar emoji"
              placeholder="Buscar emoji"
              className="h-9 w-full rounded-md border border-neutral-200 bg-white pl-8 pr-2.5 text-body-sm text-neutral-900 placeholder:text-neutral-500 focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-100"
            />
          </div>
          {results ? null : (
            <div role="tablist" aria-label="Categorias de emoji" className="mt-2 flex gap-0.5 border-b border-line pb-1.5">
              {tabs.map((t) => {
                const Icon = TAB_ICON[t.id];
                const selected = t.id === tab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={`${id}-tab-${t.id}`}
                    aria-selected={selected}
                    aria-controls={`${id}-panel`}
                    aria-label={t.label}
                    title={t.label}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex h-8 flex-1 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-purple-500",
                      selected ? "bg-purple-100 text-purple-700" : "text-neutral-600 hover:bg-purple-50 hover:text-purple-600",
                    )}
                  >
                    <Icon aria-hidden className="size-4" />
                  </button>
                );
              })}
            </div>
          )}
          <div id={`${id}-panel`} role={results ? undefined : "tabpanel"} aria-labelledby={results ? undefined : `${id}-tab-${tab}`} className="mt-2">
            <p className="px-1 text-caption font-semibold text-neutral-600" aria-live={results ? "polite" : undefined}>
              {results ? (results.length ? `${heading}: ${results.length}` : "Nenhum emoji encontrado") : heading}
            </p>
            <div onKeyDown={onGridKeyDown} className="mt-1 grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto">
              {emojis.map((emoji, i) => (
                <button
                  key={emoji.char}
                  type="button"
                  data-emoji
                  tabIndex={i === 0 ? 0 : -1}
                  onClick={() => pick(emoji)}
                  aria-label={emoji.name}
                  title={emoji.name}
                  className="flex aspect-square items-center justify-center rounded-md text-[22px] leading-none transition-colors hover:bg-purple-50 focus-visible:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-500"
                >
                  {emoji.char}
                </button>
              ))}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Botão de emoji ligado a um campo: insere no cursor do campo indicado. */
export function EmojiInsertButton({
  target,
  disabled,
  className,
}: {
  target: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <EmojiPicker
      disabled={disabled}
      className={className}
      onPick={(emoji) => {
        if (target.current) insertAtCaret(target.current, emoji);
      }}
    />
  );
}
