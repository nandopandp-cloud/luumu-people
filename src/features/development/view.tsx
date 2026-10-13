import type { Route } from "next";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { LinkTabs } from "@/design-system/components/link-tabs";
import type { Development } from "@/server/modules/development/service";
import { AchievementsPanel } from "./achievements";
import { CycleSelect } from "./cycle-select";
import { CreatePdiButton } from "./forms";
import { GoalsAccordion } from "./goals-accordion";
import { formatDay } from "./labels";
import { MentorshipCard } from "./mentorship";
import { OverviewStats } from "./overview";
import { PdiWorkspace } from "./pdi-workspace";
import { AchievementsCard, CompetenciesCard, EvolutionCard, focusCompetencies, KeepGoingCard, ProgressMonthsCard } from "./side-cards";
import { CompetencyGrid, EvolutionPanel } from "./sections";

export const DEVELOPMENT_TABS = [
  { value: "visao-geral", label: "Visão geral" },
  { value: "pdi", label: "Meu PDI" },
  { value: "competencias", label: "Competências" },
  { value: "evolucao", label: "Evolução" },
  { value: "conquistas", label: "Conquistas" },
] as const;
export type DevelopmentTab = (typeof DEVELOPMENT_TABS)[number]["value"] | "historico";

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
      {pdi && pdis.length ? (
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
  /** Pessoa gerida (visão da gestão): os formulários enviam o `userId`. */
  managedUserId?: string;
  evolution?: { month: string; average: number | null }[];
};

/** Conteúdo de cada aba, igual para a própria pessoa e para a liderança (com os controles dela). */
export function DevelopmentTabContent({ tab, development, base, managedUserId, evolution }: ContentProps) {
  const { pdi, isSelf, competencies, milestones, canManage, canUpdateProgress, competencyOptions, person } = development;
  const chosen = pdi && pdi.status !== "active" ? pdi.id : null;
  const href = (t: string) => tabHref(base, t, chosen);
  const goalCompetencies = (pdi?.goals ?? []).map((g) => g.competencyId);

  if (tab === "competencias") return <CompetencyGrid development={development} assessAs={canManage ? "manager" : null} />;
  if (tab === "conquistas") return <AchievementsPanel development={development} />;
  if (tab === "evolucao") {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <EvolutionPanel points={evolution ?? []} />
        {pdi ? (
          <div className="space-y-5">
            <EvolutionCard id="evolucao-pdi" title="Evolução do PDI" timeline={pdi.timeline} />
            <ProgressMonthsCard id="acoes-mes" title="Ações concluídas por mês" stats={pdi.stats} timeline={pdi.timeline} />
          </div>
        ) : null}
      </div>
    );
  }

  if (tab === "pdi") {
    if (!pdi) return <NoPdi development={development} managedUserId={managedUserId} />;
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PdiWorkspace pdiId={pdi.id} goals={pdi.goals} personId={person.id} isSelf={isSelf} canUpdate={canUpdateProgress} canManage={canManage} competencyOptions={competencyOptions} />
        <aside aria-label="Progresso, competências e mentoria" className="space-y-5">
          <ProgressMonthsCard id="meu-progresso" title={isSelf ? "Meu progresso" : "Progresso"} stats={pdi.stats} timeline={pdi.timeline} href={href("evolucao")} />
          <CompetenciesCard id="competencias-foco" title="Competências em foco" competencies={focusCompetencies(competencies, goalCompetencies)} href={href("competencias")} />
          <MentorshipCard pdiId={pdi.id} personId={person.id} mentor={pdi.mentor} isSelf={isSelf} canManage={canManage} />
        </aside>
      </div>
    );
  }

  // Visão geral
  return (
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
  );
}
