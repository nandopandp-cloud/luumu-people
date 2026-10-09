import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { cn } from "@/design-system/cn";
import { FeaturedCarousel } from "@/features/announcements/mural/featured-carousel";
import { FeedFilters } from "@/features/announcements/mural/feed-filters";
import { AnnouncementRow, QuickLinksCard, UpcomingEventsCard } from "@/features/announcements/mural/sections";
import { WeeklyHighlight } from "@/features/announcements/mural/weekly-highlight";
import { ANNOUNCEMENT_CATEGORY } from "@/features/home/labels";
import { PageHero } from "@/features/page/page-hero";
import { ANNOUNCEMENT_CATEGORIES } from "@/server/db/schema/learning";
import { requireActor } from "@/server/dal";
import {
  FEED_PERIODS,
  FEED_TABS,
  listAnnouncements,
  listFeaturedAnnouncements,
  listWeeklyHighlights,
  type AnnouncementCategory,
  type FeedPeriod,
  type FeedTab,
} from "@/server/modules/announcements/service";
import { listUpcomingEvents } from "@/server/modules/communication/events";
import { listActiveQuickLinks } from "@/server/modules/communication/quick-links";

export const metadata: Metadata = { title: "Comunicados" };

type SP = PageProps<"/comunicados">["searchParams"];

const PAGE = 10;
const PERIOD_LABEL: Record<FeedPeriod, string> = { recentes: "Mais recentes", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", "90d": "Últimos 3 meses" };

/** Abas da referência: três recortes do mural + atalhos para três categorias. */
const TABS: { label: string; tab?: FeedTab; category?: AnnouncementCategory }[] = [
  { label: "Todos" },
  { label: "Importantes", tab: "importantes" },
  { label: "Minha área", tab: "minha-area" },
  { label: "Institucional", category: "institucional" },
  { label: "Pessoas", category: "gente_gestao" },
  { label: "Eventos", category: "evento" },
];

async function parse(searchParams: SP) {
  const raw = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const aba = one(raw.aba);
  const categoria = one(raw.categoria);
  const periodo = one(raw.periodo);
  return {
    tab: (FEED_TABS as readonly string[]).includes(aba ?? "") ? (aba as FeedTab) : "todos",
    category: (ANNOUNCEMENT_CATEGORIES as readonly string[]).includes(categoria ?? "") ? (categoria as AnnouncementCategory) : undefined,
    period: (FEED_PERIODS as readonly string[]).includes(periodo ?? "") ? (periodo as FeedPeriod) : "recentes",
    limit: Math.min(60, Math.max(PAGE, Number(one(raw.mais)) || PAGE)),
  };
}
type Parsed = Awaited<ReturnType<typeof parse>>;

const href = (p: { tab?: FeedTab; category?: AnnouncementCategory; period?: FeedPeriod; limit?: number }) => ({
  pathname: "/comunicados",
  query: {
    ...(p.tab && p.tab !== "todos" && { aba: p.tab }),
    ...(p.category && { categoria: p.category }),
    ...(p.period && p.period !== "recentes" && { periodo: p.period }),
    ...(p.limit && { mais: String(p.limit) }),
  },
});

export default function AnnouncementsPage({ searchParams }: PageProps<"/comunicados">) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <PageHero title="Comunicados" description="Fique por dentro das novidades, iniciativas e tudo o que acontece na nossa empresa." bubble="Informação também aproxima pessoas!" className="mb-5">
          <Suspense fallback={<Skeleton className="h-10 w-full max-w-2xl rounded-full" />}>
            <Tabs searchParams={searchParams} />
          </Suspense>
        </PageHero>
        <Suspense fallback={<FeedSkeleton />}>
          <Feed searchParams={searchParams} />
        </Suspense>
      </div>
      <aside aria-label="Destaques, agenda e filtros" className="space-y-5">
        <Suspense fallback={<AsideSkeleton />}>
          <Aside searchParams={searchParams} />
        </Suspense>
      </aside>
    </div>
  );
}

async function Tabs({ searchParams }: { searchParams: SP }) {
  const { tab, category, period } = await parse(searchParams);
  const isCurrent = (t: (typeof TABS)[number]) => (t.tab ? t.tab === tab : t.category ? tab === "todos" && t.category === category : tab === "todos" && !category);
  return (
    <nav aria-label="Recortes do mural">
      <ul className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const current = isCurrent(t);
          return (
            <li key={t.label}>
              <Link
                href={href({ tab: t.tab, category: t.category, period })}
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-md px-5 text-body-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
                  current ? "bg-purple-500 text-white shadow-sm" : "bg-neutral-100 text-neutral-700 hover:bg-purple-50 hover:text-purple-600",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

async function Feed({ searchParams }: { searchParams: SP }) {
  const [actor, query] = await Promise.all([requireActor(), parse(searchParams)]);
  // Destaques só na visão geral do mural; quem está nele não se repete na lista.
  const overview = query.tab === "todos" && !query.category && query.period === "recentes";
  const featured = overview ? await listFeaturedAnnouncements(actor) : [];
  const { items, total } = await listAnnouncements(actor, { ...query, exclude: featured.map((f) => f.id) });

  return (
    <>
      {featured.length > 0 ? <FeaturedCarousel slides={featured.map(({ id, title, summary, coverFileId, theme, illustration }) => ({ id, title, summary, coverFileId, theme, illustration }))} /> : null}
      <section aria-labelledby="mural">
        <h2 id="mural" className="sr-only">
          Mural de comunicados
        </h2>
        {items.length === 0 ? (
          <EmptyFeed query={query} hasFeatured={featured.length > 0} />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <AnnouncementRow item={item} />
              </li>
            ))}
          </ul>
        )}
        {total > items.length ? (
          <div className="mt-5 text-center">
            <Button asChild variant="secondary">
              <Link href={href({ ...query, limit: query.limit + PAGE })} scroll={false}>
                Ver mais ({total - items.length})
              </Link>
            </Button>
          </div>
        ) : null}
      </section>
    </>
  );
}

function EmptyFeed({ query, hasFeatured }: { query: Parsed; hasFeatured: boolean }) {
  if (hasFeatured) return null;
  const filtered = query.tab !== "todos" || query.category || query.period !== "recentes";
  const title = query.tab === "minha-area" ? "Nenhum comunicado para a sua área" : filtered ? "Nenhum comunicado com esses filtros" : "Nenhum comunicado por enquanto";
  return (
    <div className="card p-6">
      <EmptyState
        title={title}
        description={filtered ? "Veja todos os comunicados ou ajuste os filtros." : "Quando houver novidades para você, elas aparecem aqui."}
        action={
          filtered ? (
            <Button asChild variant="soft">
              <Link href="/comunicados">Ver todos</Link>
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

async function Aside({ searchParams }: { searchParams: SP }) {
  const [actor, query] = await Promise.all([requireActor(), parse(searchParams)]);
  const [weekly, events, links] = await Promise.all([listWeeklyHighlights(actor), listUpcomingEvents(actor, 3), listActiveQuickLinks(actor)]);
  return (
    <>
      {weekly.length > 0 ? <WeeklyHighlight slides={weekly.map(({ id, title, summary, coverFileId, theme, illustration }) => ({ id, title, summary, coverFileId, theme, illustration }))} /> : null}
      <UpcomingEventsCard events={events} />
      <QuickLinksCard links={links} />
      <FeedFilters
        base="/comunicados"
        categories={ANNOUNCEMENT_CATEGORIES.map((c) => ({ value: c, label: ANNOUNCEMENT_CATEGORY[c]?.label ?? c }))}
        periods={FEED_PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
        values={{ categoria: query.category ?? "", periodo: query.period, aba: query.tab === "todos" ? undefined : query.tab }}
      />
    </>
  );
}

function FeedSkeleton() {
  return (
    <div aria-hidden className="space-y-3">
      <Skeleton className="mb-5 h-[230px] rounded-xl" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[156px] rounded-xl" />
      ))}
    </div>
  );
}

function AsideSkeleton() {
  return (
    <div aria-hidden className="space-y-5">
      <Skeleton className="h-[220px] rounded-xl" />
      <Skeleton className="h-[300px] rounded-xl" />
      <Skeleton className="h-[160px] rounded-xl" />
    </div>
  );
}

