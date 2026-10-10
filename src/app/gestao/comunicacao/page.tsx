import { Archive, ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, Clock3, FilePen, Files, List as ListIcon, Megaphone, Minus, Plus, Search, type LucideIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Mascot } from "@/design-system/components/brand";
import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { cn } from "@/design-system/cn";
import { ManagedFilters } from "@/features/announcements/managed-filters";
import { ManagedTable } from "@/features/announcements/managed-table";
import { CommunicationTabs } from "@/features/banners/communication-tabs";
import { hasTenantWide } from "@/server/authz/policy";
import { requirePermission } from "@/server/dal";
import { ANNOUNCEMENT_CATEGORIES } from "@/server/db/schema/learning";
import { MANAGED_FILTERS, type ManagedFilter } from "@/server/modules/announcements/schemas";
import { listManagedAnnouncements, managedSummary, type AnnouncementCategory, type StatusTrend } from "@/server/modules/announcements/service";

export const metadata: Metadata = { title: "Comunicação" };

const PAGE_SIZE = 10;
const FILTERS: Record<ManagedFilter, { label: string; icon: LucideIcon }> = {
  todos: { label: "Todos", icon: ListIcon },
  rascunhos: { label: "Rascunhos", icon: FilePen },
  agendados: { label: "Agendados", icon: Clock3 },
  publicados: { label: "Publicados", icon: CheckCircle2 },
  arquivados: { label: "Arquivados", icon: Archive },
};

type SP = PageProps<"/gestao/comunicacao">["searchParams"];

async function parse(searchParams: SP) {
  const raw = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filtro = one(raw.filtro);
  const categoria = one(raw.categoria);
  return {
    filter: (MANAGED_FILTERS as readonly string[]).includes(filtro ?? "") ? (filtro as ManagedFilter) : "todos",
    category: (ANNOUNCEMENT_CATEGORIES as readonly string[]).includes(categoria ?? "") ? (categoria as AnnouncementCategory) : undefined,
    q: (one(raw.q) ?? "").trim().slice(0, 100),
    page: Math.max(1, Math.min(1000, Number(one(raw.pagina)) || 1)),
  };
}
type Parsed = Awaited<ReturnType<typeof parse>>;

/** Query string da lista (sem página 1 nem valores padrão). */
function queryOf(p: Partial<Parsed>) {
  const q: Record<string, string> = {};
  if (p.filter && p.filter !== "todos") q.filtro = p.filter;
  if (p.q) q.q = p.q;
  if (p.category) q.categoria = p.category;
  if (p.page && p.page > 1) q.pagina = String(p.page);
  return q;
}
const hrefOf = (p: Partial<Parsed>) => {
  const qs = new URLSearchParams(queryOf(p)).toString();
  return `/gestao/comunicacao${qs ? `?${qs}` : ""}`;
};

export default function CommunicationPage({ searchParams }: PageProps<"/gestao/comunicacao">) {
  return (
    <>
      <header className="relative mb-6 flex flex-wrap items-center gap-6 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-10 right-40 hidden h-56 w-96 rounded-full bg-purple-100/70 blur-3xl lg:block" />
        <div className="relative min-w-0 flex-1">
          <Link href="/gestao" className="mb-3 inline-flex items-center gap-1 text-body-sm text-neutral-600 hover:text-purple-600">
            <ChevronLeft aria-hidden className="size-4" /> Gestão
          </Link>
          <h1 className="text-display font-extrabold leading-tight tracking-[-0.03em] text-neutral-900">Comunicação</h1>
          <p className="mt-2 text-[17px] text-neutral-600">Mural corporativo: escreva, publique, agende e fixe comunicados.</p>
        </div>
        <div aria-hidden className="relative hidden h-36 w-56 shrink-0 lg:block">
          <Mascot className="absolute bottom-0 left-4 h-32" />
          <span className="absolute bottom-6 right-2 flex size-16 -rotate-12 items-center justify-center rounded-full bg-white shadow-md">
            <Megaphone className="size-9 text-purple-600" />
          </span>
          <span className="absolute right-0 top-3 h-1.5 w-7 rotate-[-35deg] rounded-full bg-orange-500" />
          <span className="absolute right-6 top-0 h-1.5 w-6 rotate-[-70deg] rounded-full bg-orange-500" />
        </div>
        <Button asChild size="lg" className="relative h-14 px-8 text-body shadow-md">
          <Link href="/gestao/comunicacao/novo">
            <Plus aria-hidden /> Novo comunicado
          </Link>
        </Button>
      </header>
      <Suspense fallback={null}>
        <Sections />
      </Suspense>
      <Suspense fallback={<Skeleton className="mb-6 h-[96px] rounded-xl" />}>
        <Summary />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
        <List searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Sections() {
  const actor = await requirePermission("comms.announcement.create");
  return <CommunicationTabs current="comunicados" actor={actor} />;
}

function Trend({ t }: { t: StatusTrend }) {
  const { thisMonth: now, lastMonth: before } = t;
  if (now === before) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-semibold text-neutral-600">
        <Minus aria-hidden className="size-3" /> 0%
        <span className="sr-only"> em relação ao mês anterior</span>
      </span>
    );
  }
  const up = now > before;
  const pct = before === 0 ? null : Math.round((Math.abs(now - before) / before) * 100);
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-caption font-semibold", up ? "bg-green-100 text-green-700" : "bg-red-50 text-red-600")}>
      {up ? <ArrowUp aria-hidden className="size-3" /> : <ArrowDown aria-hidden className="size-3" />}
      {pct === null ? "novo" : `${pct}%`}
      <span className="sr-only"> {up ? "a mais" : "a menos"} que no mês anterior</span>
    </span>
  );
}

const KPIS: { key: "total" | "published" | "scheduled" | "draft" | "archived"; label: string; icon: LucideIcon; tile: string }[] = [
  { key: "total", label: "Total de comunicados", icon: Files, tile: "bg-purple-100 text-purple-600" },
  { key: "published", label: "Publicados", icon: CheckCircle2, tile: "bg-green-100 text-green-700" },
  { key: "scheduled", label: "Agendados", icon: Clock3, tile: "bg-orange-100 text-orange-700" },
  { key: "draft", label: "Rascunhos", icon: FilePen, tile: "bg-purple-100 text-purple-600" },
  { key: "archived", label: "Arquivados", icon: Archive, tile: "bg-neutral-100 text-neutral-700" },
];

async function Summary() {
  const summary = await managedSummary(await requirePermission("comms.announcement.create"));
  return (
    <section aria-label="Resumo dos comunicados" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {KPIS.map((k) => {
        const t = summary[k.key];
        return (
          <div key={k.key} className="card flex items-start gap-4 p-5">
            <span aria-hidden className={cn("flex size-14 shrink-0 items-center justify-center rounded-lg", k.tile)}>
              <k.icon className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-h2 font-extrabold leading-none text-neutral-900">{t.count}</p>
                <Trend t={t} />
              </div>
              <p className={cn("mt-1.5 text-body-sm", k.key === "total" ? "font-medium text-purple-600" : "text-neutral-600")}>{k.label}</p>
              {k.key === "total" ? <p className="text-caption text-neutral-500">vs. mês anterior</p> : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}

async function List({ searchParams }: { searchParams: SP }) {
  const [actor, query] = await Promise.all([requirePermission("comms.announcement.create"), parse(searchParams)]);
  const { items, total } = await listManagedAnnouncements(actor, { ...query, pageSize: PAGE_SIZE });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(query.q || query.category);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Situação dos comunicados" className="mr-auto">
          <ul className="flex flex-wrap gap-2">
            {MANAGED_FILTERS.map((f) => {
              const { label, icon: Icon } = FILTERS[f];
              const current = f === query.filter;
              return (
                <li key={f}>
                  <Link
                    href={hrefOf({ ...query, filter: f, page: 1 }) as Route}
                    scroll={false}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "inline-flex h-11 items-center gap-2 rounded-md px-5 text-body-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
                      current ? "bg-purple-500 text-white shadow-sm" : "bg-neutral-100 text-neutral-700 hover:bg-purple-50 hover:text-purple-600",
                    )}
                  >
                    <Icon aria-hidden className="size-4" /> {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <form role="search" action="/gestao/comunicacao" method="get" className="relative w-full sm:w-80">
          {query.filter !== "todos" ? <input type="hidden" name="filtro" value={query.filter} /> : null}
          {query.category ? <input type="hidden" name="categoria" value={query.category} /> : null}
          <label htmlFor="busca-comunicados" className="sr-only">
            Buscar comunicados
          </label>
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
          <input
            id="busca-comunicados"
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder="Buscar comunicados..."
            className="h-11 w-full rounded-full border border-line bg-white pl-11 pr-4 text-body-sm text-neutral-900 placeholder:text-neutral-500 focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-100"
          />
        </form>
        <ManagedFilters category={query.category ?? ""} baseQuery={queryOf({ ...query, category: undefined, page: 1 })} />
      </div>

      {items.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            title={filtered ? "Nenhum comunicado encontrado" : query.filter === "todos" ? "Nenhum comunicado criado" : "Nada por aqui neste filtro"}
            description={filtered ? "Tente outra busca ou limpe os filtros." : "Crie um comunicado para aparecer no mural de todas as pessoas."}
            action={
              filtered ? (
                <Button asChild variant="soft">
                  <Link href={hrefOf({ filter: query.filter }) as Route}>Limpar busca e filtros</Link>
                </Button>
              ) : (
                <Button asChild variant="soft">
                  <Link href="/gestao/comunicacao/novo">
                    <Plus aria-hidden /> Novo comunicado
                  </Link>
                </Button>
              )
            }
          />
        </div>
      ) : (
        <ManagedTable
          // Nova lista do servidor = seleção zerada.
          key={`${query.filter}|${query.q}|${query.category}|${query.page}`}
          canPublish={hasTenantWide(actor, "comms.announcement.publish")}
          total={total}
          page={query.page}
          pageCount={pageCount}
          pageHref={Object.fromEntries(Array.from({ length: pageCount }, (_, i) => [i + 1, hrefOf({ ...query, page: i + 1 })]))}
          rows={items.map((a) => ({
            id: a.id,
            title: a.title,
            summary: a.summary,
            category: a.category,
            theme: a.theme,
            illustration: a.illustration,
            coverFileId: a.coverFileId,
            pinned: a.pinned,
            managedStatus: a.managedStatus,
            publishedAt: a.publishedAt?.toISOString() ?? null,
            updatedAt: a.updatedAt.toISOString(),
            author: a.author,
          }))}
        />
      )}
    </div>
  );
}
