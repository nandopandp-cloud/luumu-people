"use client";

import { ArrowRight, Bell, Settings } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Skeleton } from "@/design-system/components/feedback";
import { cn } from "@/design-system/cn";
import { api, ApiError } from "@/lib/api-client";
import { PreferencesDialog } from "./controls";
import { NOTIFICATIONS_CHANGED, TABS, sendRead, type NotificationCategory, type NotificationItem, type Tab } from "./labels";
import { CategoryTile } from "./notification-row";

type Counts = { all: number; unread: number; mentions: number };
type ListResponse = { items: NotificationItem[]; counts: Counts };

const POLL_MS = 60_000;

/** Sino da barra superior: contador de não lidas e as notificações mais recentes. */
export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [tab, setTab] = useState<Tab>("todas");
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [muted, setMuted] = useState<NotificationCategory[]>([]);

  // O servidor manda um novo valor a cada navegação (ajuste durante a renderização).
  const [serverUnread, setServerUnread] = useState(initialUnread);
  if (serverUnread !== initialUnread) {
    setServerUnread(initialUnread);
    setUnread(initialUnread);
  }
  // Fecha ao navegar.
  const [path, setPath] = useState(pathname);
  if (path !== pathname) {
    setPath(pathname);
    setOpen(false);
  }

  // Atualiza o contador periodicamente e quando a janela volta ao foco.
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const { unread: n } = await api<{ unread: number }>("/api/v1/me/notifications/unread-count");
        if (alive) setUnread(n);
      } catch {
        /* silencioso: o contador volta na próxima tentativa */
      }
    };
    const timer = window.setInterval(refresh, POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener(NOTIFICATIONS_CHANGED, onFocus);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(NOTIFICATIONS_CHANGED, onFocus);
    };
  }, []);

  const load = useCallback(async (which: Tab) => {
    setError(false);
    try {
      const response = await api<ListResponse>(`/api/v1/me/notifications?aba=${which}&limite=6`);
      setData(response);
      setUnread(response.counts.unread);
    } catch (e) {
      setError(!(e instanceof ApiError && e.status === 401));
    }
  }, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) void load(tab);
  }

  function selectTab(next: Tab) {
    setTab(next);
    setData(null);
    void load(next);
  }

  async function markAll() {
    await api("/api/v1/me/notifications/read-all", { method: "POST" }).catch(() => null);
    await load(tab);
    router.refresh();
  }

  async function openPreferences() {
    const prefs = await api<{ muted: NotificationCategory[] }>("/api/v1/me/notifications/preferences").catch(() => ({ muted: [] }));
    setMuted(prefs.muted);
    setOpen(false);
    setPrefsOpen(true);
  }

  const counts = data?.counts;
  return (
    <>
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Popover.Trigger
          aria-label={unread ? `Notificações: ${unread} não ${unread === 1 ? "lida" : "lidas"}` : "Notificações"}
          className="relative flex size-12 items-center justify-center rounded-full border border-line bg-white text-neutral-700 shadow-sm transition-colors hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500 data-[state=open]:text-purple-600"
        >
          <Bell aria-hidden className="size-5" />
          {unread ? (
            <span aria-hidden className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={10}
            collisionPadding={16}
            aria-label="Notificações"
            className="z-50 flex max-h-[min(640px,calc(100dvh-6rem))] w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-line bg-white shadow-lg"
          >
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
              <p className="text-h4 font-bold text-neutral-900">Notificações</p>
              <button
                type="button"
                onClick={markAll}
                disabled={!unread}
                className="rounded-sm text-body-sm font-semibold text-purple-600 hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-purple-500 disabled:pointer-events-none disabled:text-neutral-500"
              >
                Marcar todas como lidas
              </button>
            </div>
            <div className="flex items-center gap-2 border-b border-line px-5 pb-3">
              <div role="tablist" aria-label="Filtrar notificações" className="flex flex-1 flex-wrap gap-1.5">
                {TABS.map((t) => {
                  const selected = t.value === tab;
                  const count = counts ? (t.value === "todas" ? counts.all : t.value === "nao-lidas" ? counts.unread : counts.mentions) : null;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => selectTab(t.value)}
                      className={cn(
                        "h-8 rounded-full border px-3 text-caption font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
                        selected ? "border-purple-100 bg-purple-100 text-purple-700" : "border-line bg-white text-neutral-700 hover:bg-purple-50",
                      )}
                    >
                      {t.label}
                      {count !== null ? ` (${count})` : ""}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={openPreferences}
                aria-label="Preferências de notificação"
                title="Preferências de notificação"
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-neutral-700 hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500"
              >
                <Settings aria-hidden className="size-4" />
              </button>
            </div>

            <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto">
              {!data && !error ? (
                <ul aria-hidden className="space-y-3 p-5">
                  {[0, 1, 2, 3].map((i) => (
                    <li key={i} className="flex gap-3">
                      <Skeleton className="size-12 shrink-0 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : error ? (
                <p className="px-5 py-8 text-center text-body-sm text-neutral-600">Não foi possível carregar as notificações. Tente novamente.</p>
              ) : data!.items.length === 0 ? (
                <p className="px-5 py-10 text-center text-body-sm text-neutral-600">{tab === "nao-lidas" ? "Tudo em dia! Nenhuma notificação não lida." : "Nenhuma notificação por aqui."}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data!.items.map((n) => (
                    <li key={n.key}>
                      <Link
                        href={n.href as Route}
                        onClick={() => {
                          if (n.unread) {
                            void sendRead([n.key]);
                            setUnread((u) => Math.max(0, u - 1));
                          }
                          setOpen(false);
                        }}
                        className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-purple-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-purple-500"
                      >
                        {n.actors[0] ? (
                          <span className="relative shrink-0">
                            <Avatar name={n.actors[0].name} src={n.actors[0].image} size="lg" />
                            <CategoryTile category={n.category} className="absolute -bottom-1 -right-1 size-5 rounded-full ring-2 ring-white" iconClassName="size-3" />
                          </span>
                        ) : (
                          <CategoryTile category={n.category} className="size-12 rounded-full" iconClassName="size-5" />
                        )}
                        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.unread ? "bg-purple-500" : "bg-transparent")}>
                          <span className="sr-only">{n.unread ? "Não lida." : ""}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-3">
                            <span className="text-body-sm font-bold text-neutral-900">{n.title}</span>
                            <span className="shrink-0 text-caption text-neutral-500">{n.agoShort}</span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-body-sm text-neutral-600">
                            {n.lead ? `${n.lead} ` : ""}
                            {n.body}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-line p-4">
              <Link
                href="/notificacoes"
                onClick={() => setOpen(false)}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-line text-body-sm font-semibold text-purple-600 hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-500"
              >
                Ver todas as notificações <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {/* Recriada a cada abertura: começa sempre do que está salvo. */}
      <PreferencesDialog key={String(prefsOpen)} open={prefsOpen} onOpenChange={setPrefsOpen} muted={muted} />
    </>
  );
}
