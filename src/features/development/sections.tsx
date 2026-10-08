import { ArrowRight, ChevronRight, ClipboardList, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { AreaChart } from "@/design-system/components/charts";
import { EmptyState } from "@/design-system/components/empty-state";
import { CircularProgress, Progress } from "@/design-system/components/progress";
import { cn } from "@/design-system/cn";
import { monthLabel } from "@/features/courses/labels";
import type { CompetencyRow, Development } from "@/server/modules/development/service";
import { AssessCompetencyButton } from "./forms";
import { CATEGORY_LABEL, COMPETENCY_ICONS, formatDay, LEVEL, SOURCE_LABEL } from "./labels";

function Panel({ id, title, href, linkLabel, children, className, icon }: { id: string; title: string; href?: Route; linkLabel?: string; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <section aria-labelledby={id} className={cn("@container rounded-xl border border-line bg-white p-5 shadow-sm", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.01em] text-neutral-900">
          {icon}
          {title}
        </h2>
        {href ? (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-body-sm font-medium text-purple-600 hover:underline underline-offset-4">
            {linkLabel} <ArrowRight aria-hidden className="size-4" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Três cards do topo: progresso, competências, PDI. */
export function OverviewCards({ development, pdiHref }: { development: Development; pdiHref: Route }) {
  const { pdi, counts, isSelf } = development;
  const progress = pdi?.stats.progress ?? 0;
  const max = Math.max(1, counts.developed, counts.developing, counts.toDevelop);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel id="progresso-dev" title={isSelf ? "Meu progresso" : "Progresso"} className="bg-gradient-to-br from-purple-50 to-white">
        <div className="flex flex-col items-center gap-3 text-center @[15rem]:flex-row @[15rem]:gap-4 @[15rem]:text-left">
          <CircularProgress value={progress} label="Progresso do PDI" size={96} stroke={10} />
          <div className="min-w-0">
            <p className="text-body-sm font-semibold text-neutral-900">{progress >= 50 ? "No caminho certo! 🎯" : pdi ? "Bom começo!" : "Comece pelo PDI"}</p>
            <p className="mt-1 text-caption text-neutral-600">{pdi ? "Continue evoluindo nas suas competências e metas." : "Crie um PDI para acompanhar sua evolução."}</p>
          </div>
        </div>
      </Panel>
      <Panel id="competencias-resumo" title={isSelf ? "Minhas competências" : "Competências"} href={`${pdiHref.split("?")[0]}?aba=competencias` as Route} linkLabel="Ver todas" className="bg-gradient-to-br from-green-50/70 to-white">
        <div className="flex items-end justify-between gap-4">
          <ul className="space-y-2 text-body-sm">
            {(["developed", "developing", "to_develop"] as const).map((level) => (
              <li key={level} className="flex items-center gap-2">
                <span aria-hidden className={cn("size-3 rounded-full", LEVEL[level].dot)} />
                <span className="font-semibold text-neutral-900">{level === "developed" ? counts.developed : level === "developing" ? counts.developing : counts.toDevelop}</span>
                <span className="text-neutral-600">{LEVEL[level].label}</span>
              </li>
            ))}
          </ul>
          <div aria-hidden className="hidden h-20 items-end gap-1.5 @[17rem]:flex">
            {[counts.developed, counts.developing, counts.toDevelop].map((n, i) => (
              <span key={i} className={cn("w-4 rounded-t-md", ["bg-green-500", "bg-orange-500", "bg-pink-500"][i])} style={{ height: `${Math.max(12, (n / max) * 100)}%` }} />
            ))}
          </div>
        </div>
      </Panel>
      <Panel id="pdi-resumo" title={isSelf ? "Meu PDI" : "PDI"} className="bg-gradient-to-br from-blue-50/70 to-white">
        {pdi ? (
          <>
            <p className="-mt-2 mb-3 text-caption text-neutral-600">Plano de Desenvolvimento Individual</p>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm">
                <ClipboardList aria-hidden className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold text-neutral-900">
                  {pdi.stats.actionsDone} de {pdi.stats.actionsTotal} ações concluídas
                </p>
                <Progress value={pdi.stats.actionsTotal ? (pdi.stats.actionsDone / pdi.stats.actionsTotal) * 100 : 0} label="Ações concluídas" className="mt-1.5" />
              </div>
            </div>
            <Button asChild variant="soft" block className="mt-4">
              <Link href={pdiHref}>
                {isSelf ? "Ver meu PDI" : "Ver PDI"} <ArrowRight aria-hidden />
              </Link>
            </Button>
          </>
        ) : (
          <p className="text-body-sm text-neutral-600">Nenhum PDI ativo.</p>
        )}
      </Panel>
    </div>
  );
}

/** Próximas ações abertas do PDI (por prazo). */
export function NextActionsList({ development, pdiHref }: { development: Development; pdiHref: Route }) {
  const open = (development.pdi?.goals ?? [])
    .flatMap((g) => g.actions.map((a) => ({ ...a, goalTitle: g.title })))
    .filter((a) => a.status === "not_started" || a.status === "in_progress")
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 5);
  return (
    <Panel id="proximas-acoes" title="Próximas ações do PDI" href={pdiHref} linkLabel="Ver PDI">
      {open.length === 0 ? (
        <EmptyState compact title="Tudo em dia! 🎉" description="Não há ações em aberto no momento." />
      ) : (
        <ul className="divide-y divide-line">
          {open.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-500">
                <Target aria-hidden className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-semibold text-neutral-900">{a.title}</p>
                <p className="truncate text-caption text-neutral-600">{a.goalTitle}</p>
              </div>
              {a.late ? <Badge tone="red">Atrasada</Badge> : <span className="shrink-0 text-caption text-neutral-600">{formatDay(a.dueDate)}</span>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Coluna lateral: metas com progresso. */
export function GoalsCard({ development, pdiHref }: { development: Development; pdiHref: Route }) {
  const goals = development.pdi?.goals ?? [];
  return (
    <Panel id="metas" title={development.isSelf ? "Minhas metas de desenvolvimento" : "Metas de desenvolvimento"} href={pdiHref} linkLabel="Ver todas">
      {goals.length === 0 ? (
        <p className="text-body-sm text-neutral-600">Nenhuma meta definida ainda.</p>
      ) : (
        <ul className="space-y-1">
          {goals.map((g) => {
            const Icon = COMPETENCY_ICONS[development.competencies.find((c) => c.id === g.competencyId)?.icon ?? "target"] ?? Target;
            return (
              <li key={g.id}>
                <Link href={pdiHref} className="group flex items-center gap-3 rounded-lg p-2 hover:bg-purple-50">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-500 group-hover:bg-white">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-semibold text-neutral-900">{g.title}</span>
                    <Progress value={g.progress} label={`Progresso da meta ${g.title}`} className="mt-1" />
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-neutral-500" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

const BAR_TONE: Record<CompetencyRow["level"], "green" | "orange" | "purple"> = { developed: "green", developing: "orange", to_develop: "purple" };

/** Coluna lateral: evolução nas competências (barras com o valor). */
export function CompetencyBarsCard({ development, href }: { development: Development; href: Route }) {
  return (
    <Panel id="evolucao-competencias" title="Evolução nas competências" href={href} linkLabel="Ver todas" icon={<TrendingUp aria-hidden className="size-5 text-purple-500" />}>
      <ul className="space-y-3.5">
        {development.competencies.map((c) => (
          <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-3">
            <span className="truncate text-body-sm text-neutral-800">{c.name}</span>
            <Progress value={c.score ?? 0} tone={BAR_TONE[c.level]} label={`${c.name}: ${c.score ?? 0}%`} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Grade de competências com atual x esperado e avaliação. */
export function CompetencyGrid({ development, assessAs }: { development: Development; assessAs: "self" | "manager" | null }) {
  const userId = development.isSelf ? undefined : development.person.id;
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {development.competencies.map((c) => {
        const Icon = COMPETENCY_ICONS[c.icon] ?? Target;
        const level = LEVEL[c.level];
        return (
          <li key={c.id} className="card flex flex-col p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-500">
                <Icon aria-hidden className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-h4 font-semibold text-neutral-900">{c.name}</h3>
                <p className="text-caption text-neutral-600">{CATEGORY_LABEL[c.category] ?? c.category}</p>
              </div>
              <Badge tone={level.tone}>{level.label}</Badge>
            </div>
            <div className="mt-4">
              <div className="relative h-2.5 rounded-full bg-neutral-100" role="img" aria-label={`${c.name}: atual ${c.score ?? "sem avaliação"}${c.score !== null ? "%" : ""}, esperado ${c.expected}%`}>
                <div className={cn("h-full rounded-full", level.bar)} style={{ width: `${c.score ?? 0}%` }} />
                <span aria-hidden className="absolute -top-1 h-[18px] w-0.5 rounded bg-neutral-800" style={{ left: `calc(${c.expected}% - 1px)` }} />
              </div>
              <p className="mt-2 flex justify-between text-caption text-neutral-600">
                <span>
                  Atual: <strong className="text-neutral-900">{c.score === null ? "—" : `${c.score}%`}</strong>
                </span>
                <span>
                  Esperado para o cargo: <strong className="text-neutral-900">{c.expected}%</strong>
                </span>
              </p>
            </div>
            <div className="mt-auto flex items-center justify-between gap-3 pt-3">
              <p className="text-caption text-neutral-600">{c.source ? `${SOURCE_LABEL[c.source]} · ${c.assessedAt ? new Date(c.assessedAt).toLocaleDateString("pt-BR") : ""}` : "Ainda não avaliada"}</p>
              {assessAs ? (
                <AssessCompetencyButton userId={userId} competencyId={c.id} competencyName={c.name} current={c.score} label={assessAs === "self" ? "Autoavaliar" : "Avaliar"} />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function EvolutionPanel({ points }: { points: { month: string; average: number | null }[] }) {
  const data = points.filter((p) => p.average !== null).map((p) => ({ label: monthLabel(p.month), value: p.average! }));
  return (
    <Card>
      {data.length < 2 ? (
        <EmptyState compact title="Ainda sem histórico suficiente" description="A evolução aparece depois de duas ou mais avaliações em meses diferentes." />
      ) : (
        <AreaChart title="Média das competências" description="Últimos 6 meses (última avaliação conhecida em cada mês)" valueSuffix="%" data={data} />
      )}
    </Card>
  );
}
