import type { Metadata, Route } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/design-system/components/feedback";
import { LinkTabs } from "@/design-system/components/link-tabs";
import { PdiBoard } from "@/features/development/pdi-board";
import { CompetencyBarsCard, CompetencyGrid, EvolutionPanel, GoalsCard, NextActionsList, OverviewCards } from "@/features/development/sections";
import { PageHero } from "@/features/page/page-hero";
import { requireActor } from "@/server/dal";
import { getCompetencyEvolution, getDevelopment } from "@/server/modules/development/service";

export const metadata: Metadata = { title: "Desenvolvimento" };

const TABS = [
  { value: "visao-geral", label: "Visão geral" },
  { value: "pdi", label: "Meu PDI" },
  { value: "competencias", label: "Competências" },
  { value: "evolucao", label: "Evolução" },
] as const;
type Tab = (typeof TABS)[number]["value"];
type SP = PageProps<"/desenvolvimento">["searchParams"];

async function tabOf(searchParams: SP): Promise<Tab> {
  const raw = (await searchParams).aba;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return TABS.some((t) => t.value === value) ? (value as Tab) : "visao-geral";
}

export default function DevelopmentPage({ searchParams }: PageProps<"/desenvolvimento">) {
  return (
    <>
      <Suspense fallback={<Skeleton className="mb-6 h-[230px] rounded-xl" />}>
        <Hero searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-[420px] rounded-xl" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Hero({ searchParams }: { searchParams: SP }) {
  const tab = await tabOf(searchParams);
  return (
    <PageHero
      title="Desenvolvimento"
      description="Seu crescimento é único. Aqui você acompanha suas competências, seu plano de desenvolvimento e sua evolução."
      bubble="Grandes pessoas estão sempre em desenvolvimento!"
    >
      <LinkTabs label="Seções do desenvolvimento" current={tab} items={TABS.map((t) => ({ ...t, href: (t.value === "visao-geral" ? "/desenvolvimento" : `/desenvolvimento?aba=${t.value}`) as Route }))} />
    </PageHero>
  );
}

async function Content({ searchParams }: { searchParams: SP }) {
  const [actor, tab] = await Promise.all([requireActor(), tabOf(searchParams)]);
  const development = await getDevelopment(actor);
  const pdiHref = "/desenvolvimento?aba=pdi" as Route;

  if (tab === "pdi") return <PdiBoard development={development} />;
  if (tab === "competencias") return <CompetencyGrid development={development} assessAs="self" />;
  if (tab === "evolucao") return <EvolutionPanel points={await getCompetencyEvolution(actor)} />;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        <OverviewCards development={development} pdiHref={pdiHref} />
        <NextActionsList development={development} pdiHref={pdiHref} />
      </div>
      <aside className="space-y-5" aria-label="Metas e competências">
        <GoalsCard development={development} pdiHref={pdiHref} />
        <CompetencyBarsCard development={development} href={"/desenvolvimento?aba=competencias" as Route} />
      </aside>
    </div>
  );
}
