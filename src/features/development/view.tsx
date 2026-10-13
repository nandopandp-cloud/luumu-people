import type { Route } from "next";
import type { ReactNode } from "react";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { LinkTabs } from "@/design-system/components/link-tabs";
import type { Development } from "@/server/modules/development/service";
import type { CompetencySuggestions } from "@/server/modules/development/suggestions";
import { AchievementsPanel } from "./achievements";
import { CompetencyEvolutionCard, CompetencyProfileCard } from "./competency-charts";
import { CompetencyList } from "./competency-list";
import { CompetencyStats, RecommendationsPanel, SuggestionsCard } from "./competencies-view";
import { CycleSelect } from "./cycle-select";
import { CreatePdiButton } from "./forms";
import { GoalsAccordion } from "./goals-accordion";
import { formatDay } from "./labels";
import { MentorshipCard } from "./mentorship";
import { OverviewStats } from "./overview";
import { PdiWorkspace } from "./pdi-workspace";
import { AchievementsCard, CompetenciesCard, EvolutionCard, focusCompetencies, KeepGoingCard, ProgressMonthsCard } from "./side-cards";
import { EvolutionPanel } from "./sections";

export const DEVELOPMENT_TABS = [
  { value: "visao-geral", label: "Visão geral" },
  { value: "pdi", label: "Meu PDI" },
  { value: "competencias", label: "Competências" },
  { value: "evolucao", label: "Evolução" },
  { value: "conquistas", label: "Conquistas" },
  { value: "recomendacoes", label: "Recomendações" },
] as const;
export type DevelopmentTab = (typeof DEVELOPMENT_TABS)[number]["value"] | "historico";

/** Abas em que o ciclo do PDI muda o conteúdo (nas outras, o seletor some). */
const CYCLE_TABS = new Set<string>(["visao-geral", "pdi", "evolucao"]);

/** Monta o link de uma aba mantendo o ciclo escolhido (quando não é o ativo). */
export function tabHref(base: string, tab: string, pdiParam?: string | null): Route {
  const params = new URLSearchParams();
  if (tab !== "visao-geral") params.set("aba", tab);
  if (pdiParam) params.set("pdi", pdiParam);
  const query = params.toString();
  return (query ? `${base}?${query}` : base) as Route;
}

/** Abas da área + o seletor de ciclo do PDI à direita. */
export function DevelopmentTabs({ base, tab, development, items }: { base: string; tab: string; development: Development; items: readonly { value: string; label: string }[] }) {
  const { pdi, pdis } = development;
  const chosen = pdi && pdi.status !== "active" ? pdi.id : null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <LinkTabs variant="soft" label="Seções do desenvolvimento" current={tab} className="min-w-0 max-w-full" items={items.map((t) => ({ ...t, href: tabHref(base, t.value, chosen) }))} />
      {pdi && pdis.length && CYCLE_TABS.has(tab) ? (
        <CycleSelect
          currentId={pdi.id}
          options={pdis.map((p) => ({
            id: p.id,
            title: p.title,
            period: `${formatDay(p.periodStart)} a ${formatDay(p.periodEnd)}`,
            closed: p.status !== "active",
            href: tabHref(base, tab, p.status === "active" ? null : p.id),
          }))}
        />
      ) : null}
    </div>
  );
}

function NoPdi({ development, managedUserId }: { development: Development; managedUserId?: string }) {
  const { isSelf, person, canManage } = development;
  const first = person.name.split(" ")[0];
  return (
    <Card>
      <EmptyState
        title={isSelf ? "Você ainda não tem um PDI ativo" : `${first} ainda não tem um PDI ativo`}
        description={
          isSelf
            ? "O Plano de Desenvolvimento Individual é construído com a sua liderança, que lança as metas e acompanha sua evolução."
            : "O Plano de Desenvolvimento Individual organiza metas e ações para evoluir na carreira."
        }
        action={canManage ? <CreatePdiButton userId={managedUserId} personName={isSelf ? undefined : first} /> : null}
      />
    </Card>
  );
}

type ContentProps = {
  tab: DevelopmentTab;
  development: Development;
  base: string;
  /** As abas: ficam no topo, exceto em Competências (dentro da coluna esquerda, como no mockup). */
  tabs: ReactNode;
  /** Pessoa gerida (visão da gestão): os formulários enviam o `userId`. */
  managedUserId?: string;
  evolution?: { month: string; average: number | null }[];
  /** Sugestões de conteúdo (só para a própria pessoa e com aprendizagem ligada). */
  suggestions?: CompetencySuggestions[];
  learningEnabled?: boolean;
};

/** Conteúdo de cada aba, igual para a própria pessoa e para a liderança (com os controles dela). */
export function DevelopmentTabContent({ tab, development, base, tabs, managedUserId, evolution, suggestions, learningEnabled = false }: ContentProps) {
  const { pdi, isSelf, competencies, milestones, canManage, canUpdateProgress, competencyOptions, person } = development;
  const chosen = pdi && pdi.status !== "active" ? pdi.id : null;
  const href = (t: string) => tabHref(base, t, chosen);
  const goalCompetencies = (pdi?.goals ?? []).map((g) => g.competencyId);

  if (tab === "competencias") {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {tabs}
          <div className="space-y-6">
          <CompetencyStats development={development} />
          <CompetencyList
            competencies={competencies}
            goals={(pdi?.goals ?? []).map((g) => ({ id: g.id, title: g.title, competencyId: g.competencyId, progress: g.progress }))}
            suggestions={suggestions ?? []}
            isSelf={isSelf}
            canAssess={development.canAssess}
            canManageCatalog={development.canManageCatalog}
            assessUserId={managedUserId}
            pdiHref={href("pdi")}
            evolutionHref={href("evolucao")}
            recommendationsHref={isSelf ? href("recomendacoes") : undefined}
          />
          </div>
        </div>
        <aside aria-label="Perfil, evolução e sugestões" className="space-y-5">
          <CompetencyProfileCard competencies={competencies} isSelf={isSelf} />
          <CompetencyEvolutionCard points={evolution ?? []} />
          {isSelf && learningEnabled ? <SuggestionsCard suggestions={suggestions ?? []} href={href("recomendacoes")} /> : null}
        </aside>
      </div>
    );
  }

  if (tab === "recomendacoes") {
    return (
      <>
        {tabs}
        <RecommendationsPanel suggestions={suggestions ?? []} development={development} learningEnabled={learningEnabled} />
      </>
    );
  }
  if (tab === "conquistas") {
    return (
      <>
        {tabs}
        <AchievementsPanel development={development} />
      </>
    );
  }
  if (tab === "evolucao") {
    return (
      <>
      {tabs}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <EvolutionPanel points={evolution ?? []} />
        {pdi ? (
          <div className="space-y-5">
            <EvolutionCard id="evolucao-pdi" title="Evolução do PDI" timeline={pdi.timeline} />
            <ProgressMonthsCard id="acoes-mes" title="Ações concluídas por mês" stats={pdi.stats} timeline={pdi.timeline} />
          </div>
        ) : null}
      </div>
      </>
    );
  }

  if (tab === "pdi") {
    if (!pdi) {
      return (
        <>
          {tabs}
          <NoPdi development={development} managedUserId={managedUserId} />
        </>
      );
    }
    return (
      <>
      {tabs}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PdiWorkspace pdiId={pdi.id} goals={pdi.goals} personId={person.id} isSelf={isSelf} canUpdate={canUpdateProgress} canManage={canManage} competencyOptions={competencyOptions} />
        <aside aria-label="Progresso, competências e mentoria" className="space-y-5">
          <ProgressMonthsCard id="meu-progresso" title={isSelf ? "Meu progresso" : "Progresso"} stats={pdi.stats} timeline={pdi.timeline} href={href("evolucao")} />
          <CompetenciesCard id="competencias-foco" title="Competências em foco" competencies={focusCompetencies(competencies, goalCompetencies)} href={href("competencias")} />
          <MentorshipCard pdiId={pdi.id} personId={person.id} mentor={pdi.mentor} isSelf={isSelf} canManage={canManage} />
        </aside>
      </div>
      </>
    );
  }

  // Visão geral
  return (
    <div>
      {tabs}
      <div className="space-y-6">
      <OverviewStats development={development} pdiHref={href("pdi")} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        {pdi ? (
          <GoalsAccordion goals={pdi.goals} personId={person.id} isSelf={isSelf} canUpdate={canUpdateProgress} canManage={canManage} competencyOptions={competencyOptions} pdiHref={href("pdi")} />
        ) : (
          <NoPdi development={development} managedUserId={managedUserId} />
        )}
        <aside aria-label="Competências, evolução e conquistas" className="space-y-5">
          <CompetenciesCard id="minhas-competencias" title={isSelf ? "Minhas competências" : "Competências"} competencies={focusCompetencies(competencies, goalCompetencies)} href={href("competencias")} />
          {pdi ? <EvolutionCard id="minha-evolucao" title={isSelf ? "Minha evolução" : "Evolução"} timeline={pdi.timeline} href={href("evolucao")} /> : null}
          <AchievementsCard id="conquistas-recentes" title="Conquistas recentes" milestones={milestones} href={href("conquistas")} />
          {pdi && isSelf ? <KeepGoingCard href={href("pdi")} /> : null}
        </aside>
      </div>
      </div>
    </div>
  );
}
