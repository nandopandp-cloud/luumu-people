import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { Skeleton } from "@/design-system/components/feedback";
import { LinkTabs } from "@/design-system/components/link-tabs";
import { Breadcrumb } from "@/design-system/components/navigation";
import { PdiBoard } from "@/features/development/pdi-board";
import { AssessmentHistory, CompetencyBarsCard, CompetencyGrid, EvolutionPanel, GoalsCard, OverviewCards } from "@/features/development/sections";
import { requirePermission } from "@/server/dal";
import { HttpError } from "@/server/http/errors";
import { getCompetencyEvolution, getDevelopment, listAssessmentHistory } from "@/server/modules/development/service";

export const metadata: Metadata = { title: "Desenvolvimento da pessoa" };

const TABS = [
  { value: "visao-geral", label: "Visão geral" },
  { value: "pdi", label: "PDI" },
  { value: "competencias", label: "Competências" },
  { value: "evolucao", label: "Evolução" },
  { value: "historico", label: "Histórico" },
] as const;

export default function PersonDevelopmentPage({ params, searchParams }: PageProps<"/gestao/desenvolvimento/[userId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
      <Person params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Person({ params, searchParams }: PageProps<"/gestao/desenvolvimento/[userId]">) {
  const actor = await requirePermission("development.read");
  const [{ userId }, sp] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(userId).success) notFound();
  const raw = Array.isArray(sp.aba) ? sp.aba[0] : sp.aba;
  const tab = TABS.some((t) => t.value === raw) ? raw! : "visao-geral";

  let development: Awaited<ReturnType<typeof getDevelopment>>;
  try {
    development = await getDevelopment(actor, userId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const base = `/gestao/desenvolvimento/${userId}`;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Desenvolvimento", href: "/gestao/desenvolvimento" }, { label: development.person.name }]} />
      <header className="flex flex-wrap items-center gap-4">
        <Avatar name={development.person.name} src={development.person.image} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">{development.person.name}</h1>
          <p className="text-body-sm text-neutral-600">{[development.person.position, development.person.orgUnit].filter(Boolean).join(" · ")}</p>
        </div>
        <Badge tone={development.canManage ? "purple" : "neutral"}>{development.canManage ? "Você lança metas e avaliações" : "Somente leitura"}</Badge>
      </header>
      <LinkTabs label="Seções" current={tab} items={TABS.map((t) => ({ ...t, href: (t.value === "visao-geral" ? base : `${base}?aba=${t.value}`) as Route }))} />
      {tab === "visao-geral" ? (
        <div className="space-y-6">
          <OverviewCards development={development} pdiHref={`${base}?aba=pdi` as Route} />
          <div className="grid gap-6 xl:grid-cols-2">
            <GoalsCard development={development} pdiHref={`${base}?aba=pdi` as Route} />
            <CompetencyBarsCard development={development} href={`${base}?aba=competencias` as Route} />
          </div>
          <EvolutionPanel points={await getCompetencyEvolution(actor, userId)} />
        </div>
      ) : null}
      {tab === "historico" ? <AssessmentHistory items={await listAssessmentHistory(actor, userId)} /> : null}
      {tab === "pdi" ? <PdiBoard development={development} managedUserId={userId} /> : null}
      {tab === "competencias" ? <CompetencyGrid development={development} assessAs={development.canManage ? "manager" : null} /> : null}
      {tab === "evolucao" ? <EvolutionPanel points={await getCompetencyEvolution(actor, userId)} /> : null}
    </div>
  );
}
