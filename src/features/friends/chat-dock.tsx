"use client";

import { ChevronDown, ChevronUp, MessageCirclePlus, MessagesSquare, Search, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { IconButton } from "@/design-system/components/button";
import { Skeleton } from "@/design-system/components/feedback";
import { Input } from "@/design-system/components/field";
import { Tooltip } from "@/design-system/components/tooltip";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { ChatPanel } from "./chat-panel";
import { errorMessage, friendsApi } from "./client";
import { chatDock, useChatDock } from "./dock-store";
import { ConversationRow } from "./friends-app";
import { NewConversationDialog } from "./new-conversation-dialog";
import type { ConversationDetail, ConversationSummary } from "./types";

/**
 * Chat flutuante (dock): fica no layout e acompanha a pessoa por toda a
 * plataforma. Desktop: barra "Conversas" no canto inferior direito com a lista
 * rápida e janelas de conversa ao lado (minimizar, abrir na página, fechar).
 * Celular: a conversa aberta (ex.: "Mensagem" no perfil) ocupa a tela cheia;
 * na gestão, que não tem barra inferior, há também um botão flutuante com a lista.
 * Na página /conversas a barra some (a página já é o chat), mas as janelas
 * levadas para fora ("Abrir em janela flutuante") continuam. O X da barra
 * esconde o widget até a pessoa iniciar uma conversa ou receber mensagem nova.
 */

const LIST_POLL_MS = 30_000;

function useMedia(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white", className)}>
      {count > 9 ? "9+" : count}
      <span className="sr-only"> {count === 1 ? "conversa não lida" : "conversas não lidas"}</span>
    </span>
  );
}

/**
 * Espaço no fim do conteúdo, do tamanho da barra "Conversas", para que nada no
 * fim da página fique escondido atrás dela (desktop). Sem barra (página de
 * conversas), sem espaço — a página continua do tamanho exato da tela.
 */
export function ChatDockSpacer() {
  const pathname = usePathname();
  const { hiddenAt } = useChatDock();
  if (hiddenAt || pathname === "/conversas" || pathname.startsWith("/conversas/")) return null;
  return <div aria-hidden className="hidden h-16 lg:block" />;
}

export function ChatDock({ environment = "employee" }: { environment?: "employee" | "management" }) {
  const pathname = usePathname();
  const { listOpen, windows, hiddenAt } = useChatDock();
  const [composing, setComposing] = useState(false);
  const desktop = useMedia("(min-width: 1024px)");
  const roomy = useMedia("(min-width: 1700px)");
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const onConversationsPage = pathname === "/conversas" || pathname.startsWith("/conversas/");
  const showLauncher = !onConversationsPage;

  const refresh = useCallback(async () => {
    try {
      setConversations((await friendsApi.conversations()).items);
    } catch {
      /* silencioso: tenta de novo no próximo ciclo */
    }
  }, []);

  // Lista (contador e janelas minimizadas): atualização periódica, só com a aba visível.
  useEffect(() => {
    if (!showLauncher && windows.length === 0) return;
    let alive = true;
    const load = () =>
      friendsApi
        .conversations()
        .then((r) => alive && setConversations(r.items))
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void load(), LIST_POLL_MS);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [showLauncher, windows.length]);

  // Widget fechado (X): volta sozinho quando chega mensagem depois disso.
  useEffect(() => {
    if (!hiddenAt || !conversations) return;
    const since = Date.parse(hiddenAt);
    if (conversations.some((c) => c.lastMessage && !c.lastMessage.mine && !c.lastMessage.deleted && Date.parse(c.lastMessage.at) > since)) chatDock.show();
  }, [hiddenAt, conversations]);

  const onRead = useCallback((id: string) => setConversations((list) => list?.map((c) => (c.id === id ? { ...c, unread: 0 } : c)) ?? list), []);
  const unread = conversations?.filter((c) => c.unread > 0).length ?? 0;
  const summaryOf = (id: string) => conversations?.find((c) => c.id === id);
  const open = (id: string) => {
    chatDock.open(id);
    chatDock.setListOpen(false);
  };

  const newConversation = (
    <NewConversationDialog
      open={composing}
      onOpenChange={setComposing}
      onOpened={(id) => {
        chatDock.open(id);
        chatDock.setListOpen(false);
        void refresh();
      }}
    />
  );
  if (hiddenAt) return null;

  if (!desktop) {
    const current = windows[0] && !windows[0].minimized ? windows[0] : null;
    return (
      <>
        {/* No colaborador, o celular já tem "Conversas" na barra inferior: o botão flutuante fica só na gestão. */}
        {showLauncher && environment === "management" && !listOpen && !current ? (
          <button
            type="button"
            onClick={() => chatDock.setListOpen(true)}
            aria-label={`Conversas${unread ? ` (${unread} ${unread === 1 ? "não lida" : "não lidas"})` : ""}`}
            className={cn(
              "fixed bottom-6 right-4 z-30 flex size-14 items-center justify-center rounded-full bg-purple-500 text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
            )}
          >
            <MessagesSquare aria-hidden className="size-6" />
            <UnreadBadge count={unread} className="absolute -right-0.5 -top-0.5 ring-2 ring-white" />
          </button>
        ) : null}
        {listOpen ? (
          <div className="fixed inset-0 z-50 flex flex-col bg-white">
            <DockList conversations={conversations} onOpen={open} onClose={() => chatDock.setListOpen(false)} onNew={() => setComposing(true)} unread={unread} />
          </div>
        ) : current ? (
          <div className="fixed inset-0 z-50 flex flex-col bg-white">
            <DockConversation id={current.id} onRead={onRead} onActivity={refresh} />
          </div>
        ) : null}
        {newConversation}
      </>
    );
  }

  const maxWindows = roomy || !showLauncher ? 3 : 2;
  const visible = windows.slice(0, maxWindows);
  if (!showLauncher && visible.length === 0) return null;

  return (
    <section aria-label="Conversas rápidas" className="pointer-events-none fixed bottom-0 right-6 z-40 flex flex-row-reverse items-end gap-3">
      {showLauncher ? (
        <div className={cn("pointer-events-auto flex w-[320px] flex-col overflow-hidden rounded-t-xl border border-b-0 border-line bg-white shadow-lg", listOpen && "h-[min(560px,calc(100dvh-6rem))]")}>
          {listOpen ? (
            <DockList conversations={conversations} onOpen={open} onClose={() => chatDock.setListOpen(false)} onNew={() => setComposing(true)} unread={unread} />
          ) : (
            <LauncherBar unread={unread} onClick={() => chatDock.setListOpen(true)} onNew={() => setComposing(true)} />
          )}
        </div>
      ) : null}
      {visible.map((w, i) =>
        w.minimized ? (
          <MinimizedWindow key={w.id} id={w.id} summary={summaryOf(w.id)} />
        ) : (
          <div key={w.id} className="pointer-events-auto flex h-[min(500px,calc(100dvh-6rem))] w-[350px] flex-col overflow-hidden rounded-t-xl border border-b-0 border-purple-200 bg-white shadow-lg">
            <DockConversation id={w.id} onRead={onRead} onActivity={refresh} pollMs={i === 0 ? 3_000 : 6_000} />
          </div>
        ),
      )}
      {newConversation}
    </section>
  );
}

/** Barra recolhida: abre a lista; "+" inicia conversa; X esconde o widget até chegar mensagem nova. */
function LauncherBar({ unread, onClick, onNew }: { unread: number; onClick: () => void; onNew: () => void }) {
  return (
    <div className="flex h-14 items-center pr-1.5">
      <button
        type="button"
        onClick={onClick}
        aria-expanded={false}
        className="flex h-full min-w-0 flex-1 items-center gap-3 pl-4 pr-2 text-left transition-colors hover:bg-purple-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-purple-500"
      >
        <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-purple-500 text-white shadow-sm">
          <MessagesSquare className="size-[18px]" />
        </span>
        <span className="flex-1 text-body-sm font-bold text-neutral-900">Conversas</span>
        <UnreadBadge count={unread} />
        <ChevronUp aria-hidden className="size-5 text-neutral-600" />
      </button>
      <IconButton label="Nova conversa" variant="plain" size="sm" onClick={onNew}>
        <MessageCirclePlus />
      </IconButton>
      <Tooltip content="Fechar — volta quando chegar uma mensagem nova">
        <IconButton label="Fechar conversas até chegar uma mensagem nova" variant="plain" size="sm" onClick={() => chatDock.hide()}>
          <X />
        </IconButton>
      </Tooltip>
    </div>
  );
}

function DockList({ conversations, onOpen, onClose, onNew, unread }: { conversations: ConversationSummary[] | null; onOpen: (id: string) => void; onClose: () => void; onNew: () => void; unread: number }) {
  const [search, setSearch] = useState("");
  const headingId = useId();
  const term = normalize(search);
  const visible = (conversations ?? []).filter((c) => !term || normalize(`${c.title} ${c.members.map((m) => m.name).join(" ")}`).includes(term));
  return (
    <div role="dialog" aria-labelledby={headingId} className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-line py-2.5 pl-4 pr-2">
        <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-purple-500 text-white shadow-sm">
          <MessagesSquare className="size-[18px]" />
        </span>
        <h2 id={headingId} className="flex flex-1 items-center gap-2 text-body font-bold text-neutral-900">
          Conversas <UnreadBadge count={unread} />
        </h2>
        <IconButton label="Nova conversa" variant="soft" size="sm" onClick={onNew}>
          <MessageCirclePlus />
        </IconButton>
        <IconButton label="Fechar lista de conversas" variant="plain" size="sm" onClick={onClose} aria-expanded>
          <ChevronDown className="max-lg:hidden" />
          <X className="lg:hidden" />
        </IconButton>
      </header>
      <div className="px-3 pt-3">
        <Input type="search" aria-label="Buscar conversas" placeholder="Buscar conversas…" value={search} onChange={(e) => setSearch(e.target.value)} leading={<Search />} className="h-10 rounded-full" />
      </div>
      <ul aria-label="Conversas" className="relative mt-2 min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-2">
        {conversations === null
          ? [0, 1, 2, 3].map((i) => (
              <li key={i} aria-hidden className="px-4 py-2">
                <Skeleton className="h-12 w-full" />
              </li>
            ))
          : visible.map((c) => (
              <li key={c.id}>
                <ConversationRow conversation={c} active={false} onOpen={onOpen} compact />
              </li>
            ))}
        {conversations !== null && visible.length === 0 ? (
          <li className="px-5 py-8 text-center text-body-sm text-neutral-600">{conversations.length ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda. Adicione amigos para começar."}</li>
        ) : null}
      </ul>
      <footer className="border-t border-line p-3">
        <Link
          href="/conversas"
          onClick={onClose}
          className="flex h-10 items-center justify-center rounded-full bg-purple-50 text-body-sm font-semibold text-purple-700 hover:bg-purple-100 focus-visible:outline-2 focus-visible:outline-purple-500"
        >
          Ver todas as conversas
        </Link>
      </footer>
    </div>
  );
}

/** Janela minimizada: só a barra com quem é, mensagens novas, restaurar e fechar. */
function MinimizedWindow({ id, summary }: { id: string; summary?: ConversationSummary }) {
  const title = summary?.title ?? "Conversa";
  return (
    <div className="pointer-events-auto flex h-14 w-[260px] items-center gap-2 rounded-t-xl border border-b-0 border-purple-200 bg-white pl-3 pr-1.5 shadow-lg">
      <button
        type="button"
        onClick={() => chatDock.toggleMinimized(id)}
        aria-label={`Abrir conversa com ${title}${summary?.unread ? ` (${summary.unread} não lidas)` : ""}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
      >
        {summary?.kind === "group" ? (
          <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
            <UsersRound className="size-4" />
          </span>
        ) : (
          <span className="relative shrink-0">
            <Avatar name={title} src={summary?.image ?? null} size="sm" className="ring-0" />
            {summary?.other?.online ? <span aria-hidden className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-green-500 ring-2 ring-white" /> : null}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-body-sm font-semibold text-neutral-900">{title}</span>
        <UnreadBadge count={summary?.unread ?? 0} />
        <ChevronUp aria-hidden className="size-4 shrink-0 text-neutral-600" />
      </button>
      <IconButton label={`Fechar conversa com ${title}`} variant="plain" size="sm" onClick={() => chatDock.close(id)}>
        <X />
      </IconButton>
    </div>
  );
}

/** Janela aberta: carrega os detalhes e mostra o chat compacto. */
function DockConversation({ id, onRead, onActivity, pollMs }: { id: string; onRead: (id: string) => void; onActivity: () => void; pollMs?: number }) {
  const toast = useToast();
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  useEffect(() => {
    let alive = true;
    friendsApi
      .detail(id)
      .then((d) => alive && setDetail(d))
      .catch((error) => {
        if (!alive) return;
        chatDock.close(id);
        toast({ tone: "error", title: "Conversa indisponível.", description: errorMessage(error) });
      });
    return () => {
      alive = false;
    };
  }, [id, toast]);

  if (!detail || detail.id !== id) {
    return (
      <div aria-busy="true" className="flex flex-1 flex-col">
        <div className="flex items-center gap-2.5 border-b border-line p-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex-1" />
      </div>
    );
  }
  return (
    <ChatPanel
      key={detail.id}
      variant="dock"
      detail={detail}
      meId=""
      onRead={onRead}
      onActivity={onActivity}
      onMinimize={() => chatDock.toggleMinimized(id)}
      onClose={() => chatDock.close(id)}
      pollMs={pollMs}
    />
  );
}
