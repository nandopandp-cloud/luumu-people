import type { Metadata, Route } from "next";
import { Suspense, type ReactNode } from "react";
import { Skeleton } from "@/design-system/components/feedback";
import { LinkTabs } from "@/design-system/components/link-tabs";
import {
  AchievementsMiniCard,
  CatalogSection,
  EvolutionCard,
  MyCoursesSection,
  OverallProgressCard,
  RecommendedSection,
  RemindersCard,
} from "@/features/courses/sections";
import { PageHero } from "@/features/page/page-hero";
import type { AuthenticatedActor } from "@/server/auth/session";
import { requireActor } from "@/server/dal";
import { MY_COURSE_TABS, type CatalogFilter, type MyCourseTab } from "@/server/modules/courses/service";

export const metadata: Metadata = { title: "Meus cursos" };

const TAB_LABELS: Record<MyCourseTab, string> = { "em-andamento": "Em andamento", "nao-iniciados": "Não iniciados", concluidos: "Concluídos", obrigatorios: "Obrigatórios" };
const CATALOG: CatalogFilter[] = ["todos", "trilhas", "cursos", "obrigatorios"];

export default function MyCoursesPage({ searchParams }: PageProps<"/meus-cursos">) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-7">
        <Suspense fallback={<Skeleton className="h-[230px] rounded-xl" />}>
          <Hero searchParams={searchParams} />
        </Suspense>
        <Block fallback={<Rows />}>{(actor, p) => <MyCoursesSection actor={actor} tab={p.tab} />}</Block>
        <Block fallback={<Rows />}>{(actor) => <RecommendedSection actor={actor} />}</Block>
        <Block fallback={<Rows />}>{(actor, p) => <CatalogSection actor={actor} filter={p.catalog} query={p.q} tab={p.tab} limit={p.limit} />}</Block>
      </div>
      <aside className="space-y-5" aria-label="Seu resumo de aprendizagem">
        <Block fallback={<Skeleton className="h-[160px] rounded-xl" />}>{(actor) => <OverallProgressCard actor={actor} />}</Block>
        <Block fallback={<Skeleton className="h-[300px] rounded-xl" />}>{(actor) => <RemindersCard actor={actor} />}</Block>
        <Block fallback={<Skeleton className="h-[160px] rounded-xl" />}>{(actor) => <AchievementsMiniCard actor={actor} />}</Block>
        <Block fallback={<Skeleton className="h-[260px] rounded-xl" />}>{(actor) => <EvolutionCard actor={actor} />}</Block>
      </aside>
    </div>
  );

  function Block({ fallback, children }: { fallback: ReactNode; children: (actor: AuthenticatedActor, params: Params) => ReactNode }) {
    return (
      <Suspense fallback={fallback}>
        <Resolve searchParams={searchParams}>{children}</Resolve>
      </Suspense>
    );
  }
}

type Params = { tab: MyCourseTab; catalog: CatalogFilter; q?: string; limit: number };
type SP = PageProps<"/meus-cursos">["searchParams"];

async function parse(searchParams: SP): Promise<Params> {
  const raw = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const aba = one(raw.aba);
  const catalogo = one(raw.catalogo);
  const q = one(raw.q)?.trim().slice(0, 80);
  return {
    tab: (MY_COURSE_TABS as readonly string[]).includes(aba ?? "") ? (aba as MyCourseTab) : "em-andamento",
    catalog: CATALOG.includes(catalogo as CatalogFilter) ? (catalogo as CatalogFilter) : "todos",
    q: q || undefined,
    limit: Math.min(60, Math.max(6, Number(one(raw.mais)) || 6)),
  };
}

async function Resolve({ searchParams, children }: { searchParams: SP; children: (actor: AuthenticatedActor, params: Params) => ReactNode }) {
  const [actor, params] = await Promise.all([requireActor(), parse(searchParams)]);
  return children(actor, params);
}

async function Hero({ searchParams }: { searchParams: SP }) {
  const { tab } = await parse(searchParams);
  return (
    <PageHero title="Meus cursos" description="Acompanhe seus treinamentos, continue de onde parou e descubra novos conteúdos." bubble="Aprender hoje constrói o seu próximo amanhã.">
      <LinkTabs
        label="Situação dos cursos"
        current={tab}
        items={MY_COURSE_TABS.map((t) => ({ value: t, label: TAB_LABELS[t], href: (t === "em-andamento" ? "/meus-cursos" : `/meus-cursos?aba=${t}`) as Route }))}
      />
    </PageHero>
  );
}

function Rows() {
  return (
    <div aria-hidden>
      <Skeleton className="mb-3.5 h-6 w-48" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[230px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
