"use client";

import { ArrowRight, CornerDownLeft, History, Search, X } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Dialog as RadixDialog } from "radix-ui";
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Mascot } from "@/design-system/components/brand";
import { Spinner } from "@/design-system/components/spinner";
import { cn } from "@/design-system/cn";
import { SEARCH_KIND_ICON, type SearchKind } from "./icons";

type Hit = { kind: SearchKind; id: string; title: string; subtitle: string | null; href: string };
type Group = { kind: SearchKind; label: string; items: Hit[] };
type Context = "employee" | "management";

const RECENT_KEY = "luumu:buscas-recentes";
const KIND_TONE: Record<SearchKind, string> = {
  page: "bg-neutral-100 text-neutral-700",
  course: "bg-purple-100 text-purple-600",
  path: "bg-green-100 text-green-700",
  announcement: "bg-orange-100 text-orange-700",
  survey: "bg-blue-100 text-blue-700",
  person: "bg-pink-100 text-pink-700",
  banner: "bg-yellow-100 text-yellow-800",
};

/** Base de cada caractere sem acento, preservando o comprimento (para destacar). */
const fold = (text: string) => Array.from(text, (c) => c.normalize("NFD")[0]!.toLowerCase()).join("");

function Highlight({ text, query }: { text: string; query: string }) {
  const q = fold(query.trim());
  const at = q.length >= 2 ? fold(text).indexOf(q) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-purple-100 px-0.5 text-purple-700">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Busca global em lightbox. Abre pelo campo da barra superior, por ⌘K/Ctrl+K
 * ou "/". Combobox acessível: setas navegam, Enter abre, Esc fecha.
 */
export function CommandPalette({ placeholder, context }: { placeholder: string; context: Context }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [quick, setQuick] = useState<Hit[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [shortcut, setShortcut] = useState("Ctrl K");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- plataforma só é conhecida no navegador
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut("⌘K");
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Atalhos e buscas recentes ao abrir.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o histórico local ao abrir
    setRecent(readRecent());
    if (quick.length) return;
    fetch(`/api/v1/search?context=${context}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.quick && setQuick(data.quick))
      .catch(() => {});
  }, [open, context, quick.length]);

  // Busca com debounce; cancela a anterior.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa resultados quando o termo fica curto
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/v1/search?context=${context}&q=${encodeURIComponent(q)}`, { credentials: "same-origin", signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { groups: [] }))
        .then((data) => {
          setGroups(data.groups ?? []);
          setActive(0);
          setLoading(false);
        })
        .catch((e) => {
          if (e?.name !== "AbortError") setLoading(false);
        });
    }, 160);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, context]);

  const searching = query.trim().length >= 2;
  const visibleGroups: Group[] = useMemo(() => (searching ? groups : quick.length ? [{ kind: "page", label: "Acesso rápido", items: quick }] : []), [searching, groups, quick]);
  const flat = useMemo(() => visibleGroups.flatMap((g) => g.items), [visibleGroups]);
  // Índice global do primeiro item de cada grupo (para setas e aria-activedescendant).
  const offsets = useMemo(() => visibleGroups.map((_, gi) => visibleGroups.slice(0, gi).reduce((n, g) => n + g.items.length, 0)), [visibleGroups]);
  const showAll = context === "employee" && searching;
  const total = flat.length + (showAll ? 1 : 0);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setGroups([]);
    setActive(0);
  }, []);

  function remember(term: string) {
    const t = term.trim();
    if (t.length < 2) return;
    try {
      const next = [t, ...readRecent().filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 5);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignorado */
    }
  }

  function go(href: string) {
    remember(query);
    close();
    router.push(href as Route);
  }

  function openAt(index: number) {
    if (index < flat.length) go(flat[index]!.href);
    else if (showAll) go(`/busca?q=${encodeURIComponent(query.trim())}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (total ? (a + 1) % total : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (total ? (a - 1 + total) % total : 0));
    } else if (e.key === "Enter" && total) {
      e.preventDefault();
      openAt(active);
    }
  }

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <RadixDialog.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <RadixDialog.Trigger asChild>
        <button
          type="button"
          className="group relative flex h-12 min-w-0 max-w-[620px] flex-1 items-center gap-3 rounded-full border border-line bg-white pl-5 pr-3 text-left text-body-sm text-neutral-500 shadow-sm transition-[border-color,box-shadow] hover:border-purple-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
        >
          <Search aria-hidden className="size-5 shrink-0 text-neutral-500 group-hover:text-purple-500" />
          <span className="min-w-0 flex-1 truncate">{placeholder}</span>
          <kbd className="hidden shrink-0 rounded-md border border-line bg-neutral-50 px-2 py-0.5 font-sans text-caption font-medium text-neutral-500 sm:inline">{shortcut}</kbd>
        </button>
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-neutral-900/45 backdrop-blur-sm animate-overlay-in" />
        <RadixDialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className="fixed inset-x-0 top-0 z-50 mx-auto flex max-h-dvh w-full flex-col overflow-hidden bg-white shadow-lg animate-pop-in focus:outline-none sm:top-[12vh] sm:max-h-[72vh] sm:w-[min(680px,calc(100vw-2rem))] sm:rounded-2xl sm:border sm:border-line"
        >
          <RadixDialog.Title className="sr-only">Buscar na plataforma</RadixDialog.Title>
          <div className="flex items-center gap-3 border-b border-line px-5">
            {loading ? <Spinner className="size-5 shrink-0 text-purple-500" /> : <Search aria-hidden className="size-5 shrink-0 text-purple-500" />}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              maxLength={80}
              role="combobox"
              aria-expanded={total > 0}
              aria-controls={listId}
              aria-activedescendant={total ? optionId(active) : undefined}
              aria-autocomplete="list"
              aria-label="Buscar"
              className="h-16 min-w-0 flex-1 bg-transparent text-[17px] text-neutral-900 placeholder:text-neutral-500 focus:outline-none"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca" className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900">
                <X aria-hidden className="size-4" />
              </button>
            ) : null}
            <RadixDialog.Close className="rounded-md border border-line px-2 py-1 text-caption font-medium text-neutral-500 hover:bg-neutral-50" aria-label="Fechar busca">
              Esc
            </RadixDialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
            {!searching && recent.length ? (
              <div className="px-3 pb-2 pt-1">
                <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-neutral-500">Buscas recentes</p>
                <ul className="flex flex-wrap gap-1.5">
                  {recent.map((r) => (
                    <li key={r}>
                      <button type="button" onClick={() => setQuery(r)} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-neutral-100 px-3 text-body-sm text-neutral-700 hover:bg-purple-50 hover:text-purple-600">
                        <History aria-hidden className="size-3.5" /> {r}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {searching && !loading && flat.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <Mascot className="h-20" />
                <p className="mt-3 text-body font-semibold text-neutral-900">Nada encontrado para “{query.trim()}”</p>
                <p className="mt-1 text-body-sm text-neutral-600">Tente outra palavra ou um termo mais curto.</p>
              </div>
            ) : null}

            <div role="listbox" id={listId} aria-label="Resultados da busca">
              {visibleGroups.map((g, gi) => (
                <div key={g.kind + g.label} role="group" aria-labelledby={`${listId}-${g.kind}`} className="pb-1">
                  <p id={`${listId}-${g.kind}`} className="px-3 pb-1 pt-2 text-caption font-semibold uppercase tracking-wide text-neutral-500">
                    {g.label}
                  </p>
                  {g.items.map((item, ii) => {
                    const i = offsets[gi]! + ii;
                    const Icon = SEARCH_KIND_ICON[item.kind];
                    const selected = i === active;
                    return (
                      <Fragment key={`${item.kind}-${item.id}`}>
                        <div
                          id={optionId(i)}
                          role="option"
                          aria-selected={selected}
                          onMouseMove={() => setActive(i)}
                          onClick={() => go(item.href)}
                          className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5", selected ? "bg-purple-50" : "hover:bg-neutral-50")}
                        >
                          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", KIND_TONE[item.kind])}>
                            <Icon aria-hidden className="size-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate text-body-sm font-semibold", selected ? "text-purple-700" : "text-neutral-900")}>
                              <Highlight text={item.title} query={query} />
                            </span>
                            {item.subtitle ? <span className="block truncate text-caption text-neutral-600">{item.subtitle}</span> : null}
                          </span>
                          {selected ? <CornerDownLeft aria-hidden className="size-4 shrink-0 text-purple-500" /> : null}
                        </div>
                      </Fragment>
                    );
                  })}
                </div>
              ))}
              {showAll && flat.length > 0 ? (
                <div
                  id={optionId(flat.length)}
                  role="option"
                  aria-selected={active === flat.length}
                  onMouseMove={() => setActive(flat.length)}
                  onClick={() => openAt(flat.length)}
                  className={cn("mx-1 mt-1 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-body-sm font-medium text-purple-600", active === flat.length ? "bg-purple-50" : "hover:bg-neutral-50")}
                >
                  Ver todos os resultados para “{query.trim()}” <ArrowRight aria-hidden className="size-4" />
                </div>
              ) : null}
            </div>
          </div>

          <footer className="hidden items-center gap-4 border-t border-line bg-neutral-50/70 px-5 py-2.5 text-caption text-neutral-500 sm:flex">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-line bg-white px-1.5 font-sans">↑</kbd>
              <kbd className="rounded border border-line bg-white px-1.5 font-sans">↓</kbd> navegar
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-line bg-white px-1.5 font-sans">↵</kbd> abrir
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-line bg-white px-1.5 font-sans">esc</kbd> fechar
            </span>
            <span className="ml-auto">
              Atalho: <kbd className="rounded border border-line bg-white px-1.5 font-sans">{shortcut}</kbd>
            </span>
          </footer>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
