import { AtSign, BarChart3, Bell, BellRing, Heart, Megaphone } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { cache, Suspense } from "react";
import { Mascot } from "@/design-system/components/brand";
import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { cn } from "@/design-system/cn";
import { CategoryFilters, MarkAllReadButton, PreferencesCard } from "@/features/notifications/controls";
import { TABS, type NotificationCategory, type Tab } from "@/features/notifications/labels";
import { NotificationRow } from "@/features/notifications/notification-row";
import { requireActor } from "@/server/dal";
import { NOTIFICATION_CATEGORIES } from "@/server/db/schema/notifications";
import { getNotificationPreferences, listNotifications } from "@/server/modules/notifications/service";

export const metadata: Metadata = { title: "Notificações" };

type SP = PageProps<"/notificacoes">["searchParams"];
const PAGE = 20;

async function parse(searchParams: SP) {
  const raw = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const aba = one(raw.aba);
  const tipos = one(raw.tipos);
  return {
    tab: (TABS.some((t) => t.value === aba) ? aba : "todas") as Tab,
    categories: tipos ? (tipos.split(",").filter((c) => (NOTIFICATION_CATEGORIES as readonly string[]).includes(c)) as NotificationCategory[]) : null,
    limit: Math.min(100, Math.max(PAGE, Number(one(raw.mais)) || PAGE)),
  };
}

/** Lista e preferências da pessoa, compartilhadas pelas duas colunas (uma consulta por request). */
const loadCenter = cache(async (tab: Tab, categories: string | null, limit: number) => {
  const actor = await requireActor();
  const [list, prefs] = await Promise.all([
    listNotifications(actor, { tab, categories: categories === null ? undefined : (categories.split(",").filter(Boolean) as NotificationCategory[]), limit }),
    getNotificationPreferences(actor),
  ]);
  return { ...list, muted: prefs.muted as NotificationCategory[] };
});

async function load(searchParams: SP) {
  const query = await parse(searchParams);
  return { query, data: await loadCenter(query.tab, query.categories ? query.categories.join(",") : null, query.limit) };
}

export default function NotificationsPage({ searchParams }: PageProps<"/notificacoes">) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <header className="relative mb-5 flex items-center gap-4">
          <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
            <BellRing className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[2rem] font-extrabold leading-tight tracking-[-0.03em] text-neutral-900 sm:text-display">Notificações</h1>
            <p className="mt-1 text-body text-neutral-600 sm:text-[17px]">Fique por dentro de tudo que acontece na Luumu People.</p>
          </div>
          <div aria-hidden className="relative -mb-5 hidden h-36 w-[340px] shrink-0 self-end lg:block">
            <div className="absolute inset-x-6 bottom-0 h-20 rounded-t-[80px] bg-purple-100/80 blur-xl" />
            <div className="absolute bottom-12 left-0 z-10 w-44 rounded-lg border border-line bg-white px-3.5 py-2.5 text-caption font-medium leading-snug text-neutral-800 shadow-md">
              Sempre por dentro do que importa! <span className="text-purple-500">💜</span>
            </div>
            <Mascot className="absolute bottom-0 left-[150px] h-32" />
            <span className="absolute bottom-4 right-6 flex size-14 rotate-12 items-center justify-center rounded-full bg-yellow-100 text-orange-500 shadow-md">
              <Bell className="size-8 fill-current" />
            </span>
          </div>
        </header>
        <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
          <Center searchParams={searchParams} />
        </Suspense>
      </div>
      <aside aria-label="Resumo, filtros e preferências" className="space-y-5">
        <Suspense fallback={<AsideSkeleton />}>
          <Aside searchParams={searchParams} />
        </Suspense>
      </aside>
    </div>
  );
}

async function Center({ searchParams }: { searchParams: SP }) {
  const {
    query,
    data: { items, total, counts, muted },
  } = await load(searchParams);
  const tabCount: Record<Tab, number> = { todas: counts.all, "nao-lidas": counts.unread, mencoes: counts.mentions };
  const href = (tab: Tab, mais?: number) => {
    const q = new URLSearchParams();
    if (tab !== "todas") q.set("aba", tab);
    if (query.categories) q.set("tipos", query.categories.join(",") || "nenhum");
    if (mais) q.set("mais", String(mais));
    const qs = q.toString();
    return `/notificacoes${qs ? `?${qs}` : ""}` as Route;
  };
  const filtered = Boolean(query.categories);

  return (
    <section aria-labelledby="lista-notificacoes" className="card min-w-0 p-3 sm:p-4">
        <h2 id="lista-notificacoes" className="sr-only">
          Lista de notificações
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3 pt-1 sm:px-2">
          <nav aria-label="Abas de notificações">
            <ul className="flex flex-wrap gap-2">
              {TABS.map((t) => {
                const current = t.value === query.tab;
                return (
                  <li key={t.value}>
                    <Link
                      href={href(t.value)}
                      scroll={false}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "inline-flex h-11 items-center rounded-full px-5 text-body-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
                        current ? "bg-purple-500 text-white shadow-sm" : "bg-neutral-100 text-neutral-700 hover:bg-purple-50 hover:text-purple-600",
                      )}
                    >
                      {t.label} ({tabCount[t.value]})
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <MarkAllReadButton disabled={counts.unread === 0} />
        </div>

        {items.length === 0 ? (
          <div className="px-2 py-6">
            <EmptyState
              title={query.tab === "nao-lidas" ? "Tudo em dia por aqui!" : filtered ? "Nenhuma notificação com esses filtros" : "Nenhuma notificação por enquanto"}
              description={
                query.tab === "nao-lidas"
                  ? "Você não tem notificações não lidas."
                  : filtered
                    ? "Marque outras categorias nos filtros para ver mais."
                    : "Quando houver comunicados, pesquisas ou interações com você, elas aparecem aqui."
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.key} id={n.key.replace(":", "-")} className="py-1 first:pt-0 last:pb-0">
                <NotificationRow item={n} muted={muted} />
              </li>
            ))}
          </ul>
        )}

        {total > items.length ? (
          <div className="pt-4 text-center">
            <Button asChild variant="secondary">
              <Link href={href(query.tab, query.limit + PAGE)} scroll={false}>
                Ver mais ({total - items.length})
              </Link>
            </Button>
          </div>
        ) : null}
    </section>
  );
}

async function Aside({ searchParams }: { searchParams: SP }) {
  const {
    query,
    data: { counts, muted },
  } = await load(searchParams);
  return (
    <>
        <section aria-labelledby="resumo-notificacoes" className="card p-5">
          <h2 id="resumo-notificacoes" className="mb-4 text-h4 font-bold text-neutral-900">
            Resumo das notificações
          </h2>
          <ul className="space-y-3">
            {[
              { label: "Pesquisas", count: counts.groups.surveys, icon: BarChart3, tile: "bg-purple-100 text-purple-600" },
              { label: "Comunicados", count: counts.groups.announcements, icon: Megaphone, tile: "bg-green-100 text-green-700" },
              { label: "Menções", count: counts.groups.mentions, icon: AtSign, tile: "bg-purple-100 text-purple-600" },
              { label: "Interações", count: counts.groups.interactions, icon: Heart, tile: "bg-pink-100 text-red-500", filled: true },
            ].map(({ label, count, icon: Icon, tile, filled }) => (
              <li key={label} className="flex items-center gap-3">
                <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tile)}>
                  <Icon className={cn("size-5", filled && "fill-current")} />
                </span>
                <span className="flex-1 text-body-sm font-medium text-neutral-800">{label}</span>
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-purple-50 px-2 text-caption font-bold text-purple-700">{count}</span>
              </li>
            ))}
          </ul>
        </section>
        <CategoryFilters selected={query.categories} tab={query.tab} />
        <PreferencesCard muted={muted} />
    </>
  );
}

function AsideSkeleton() {
  return (
    <div aria-hidden className="space-y-5">
      <Skeleton className="h-[240px] rounded-xl" />
      <Skeleton className="h-[320px] rounded-xl" />
    </div>
  );
}
