"use client";

import { ChevronLeft, ChevronRight, Pencil, Plus, Target } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";
import { CircularProgress } from "@/design-system/components/progress";
import { cn } from "@/design-system/cn";
import type { PdiGoal } from "@/server/modules/development/service";
import { ActionRow } from "./action-row";
import { AddActionButton, AddGoalButton, EditGoalDialog } from "./forms";
import { displayStatus, type ActionDisplayStatus } from "./labels";

type Filter = "all" | Exclude<ActionDisplayStatus, "cancelled">;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "in_progress", label: "Em andamento" },
  { value: "done", label: "Concluídos" },
  { value: "late", label: "Atrasados" },
  { value: "not_started", label: "Não iniciados" },
];

type Props = {
  pdiId: string;
  goals: PdiGoal[];
  personId: string;
  isSelf: boolean;
  canUpdate: boolean;
  canManage: boolean;
  competencyOptions: { id: string; name: string }[];
};

/**
 * Meu PDI: o objetivo em foco (o principal é o primeiro; dá para passar pelos
 * outros) e os planos de ação dele, com filtro por situação.
 */
export function PdiWorkspace({ pdiId, goals, personId, isSelf, canUpdate, canManage, competencyOptions }: Props) {
  const [index, setIndex] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState(false);
  const goal = goals[Math.min(index, goals.length - 1)];

  if (!goal) {
    return (
      <section className="rounded-xl border border-line bg-white shadow-sm">
        <EmptyState
          title="Nenhum objetivo ainda"
          description={isSelf ? "Os objetivos do seu PDI são definidos com a sua liderança." : "Comece definindo um objetivo de desenvolvimento."}
          action={canManage ? <AddGoalButton pdiId={pdiId} competencies={competencyOptions} /> : null}
        />
      </section>
    );
  }

  const actions = goal.actions.filter((a) => a.status !== "cancelled" || canManage);
  const countable = goal.actions.filter((a) => a.status !== "cancelled");
  const done = countable.filter((a) => a.status === "done").length;
  const countOf = (f: Filter) => (f === "all" ? actions.length : actions.filter((a) => displayStatus(a) === f).length);
  const visible = filter === "all" ? actions : actions.filter((a) => displayStatus(a) === filter);
  const label = index === 0 ? (isSelf ? "Meu objetivo principal" : "Objetivo principal") : `Objetivo ${index + 1} de ${goals.length}`;

  function go(next: number) {
    setIndex(next);
    setFilter("all");
  }

  return (
    <section aria-labelledby="objetivo-foco" className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      {/* Objetivo em foco */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 to-purple-500 p-5 text-white sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 gap-4">
            <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30">
              <Target className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-body-sm font-medium text-white/90">{label}</p>
                {canManage ? (
                  <Button size="sm" onClick={() => setEditing(true)} className="bg-white/95 text-purple-700 shadow-none hover:bg-white">
                    <Pencil aria-hidden /> Editar objetivo
                  </Button>
                ) : null}
              </div>
              <h2 id="objetivo-foco" className="mt-1 text-h2 font-bold leading-tight">
                {goal.title}
              </h2>
              {goal.description ? <p className="mt-2 max-w-2xl text-body-sm text-white/90">{goal.description}</p> : null}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {(goal.tags.length ? goal.tags : goal.competencyName ? [goal.competencyName] : []).map((tag) => (
                  <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-caption font-semibold text-white ring-1 ring-white/30">
                    {tag}
                  </span>
                ))}
                {goals.length > 1 ? (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/10 p-1 ring-1 ring-white/30">
                    <IconButton label="Objetivo anterior" variant="plain" size="sm" disabled={index === 0} onClick={() => go(index - 1)} className="text-white hover:bg-white/20 hover:text-white">
                      <ChevronLeft />
                    </IconButton>
                    <span className="px-1 text-caption font-semibold tabular-nums">
                      {index + 1} de {goals.length}
                    </span>
                    <IconButton label="Próximo objetivo" variant="plain" size="sm" disabled={index === goals.length - 1} onClick={() => go(index + 1)} className="text-white hover:bg-white/20 hover:text-white">
                      <ChevronRight />
                    </IconButton>
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4 rounded-xl bg-white p-4 text-neutral-900 shadow-md lg:w-44 lg:flex-col lg:gap-2 lg:text-center">
            <CircularProgress value={goal.progress} label={`Progresso do objetivo ${goal.title}`} size={84} stroke={9} />
            <div>
              <p className="text-caption font-semibold text-neutral-900">Progresso do objetivo</p>
              <p className="text-[11px] text-neutral-600">
                {done} de {countable.length} ações concluídas
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Planos de ação */}
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-h3 font-bold text-neutral-900">
            Planos de ação <span className="font-medium text-neutral-500">({actions.length})</span>
          </h3>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <AddGoalButton
                pdiId={pdiId}
                competencies={competencyOptions}
                trigger={
                  <Button variant="secondary">
                    <Plus aria-hidden /> Novo objetivo
                  </Button>
                }
              />
              <AddActionButton
                goals={goals}
                goalId={goal.id}
                trigger={
                  <Button>
                    <Plus aria-hidden /> Nova ação
                  </Button>
                }
              />
            </div>
          ) : null}
        </div>
        <div role="group" aria-label="Filtrar ações por situação" className="mt-3 flex flex-wrap gap-2">
          {FILTERS.filter((f) => f.value === "all" || f.value === filter || countOf(f.value) > 0).map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-caption font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
                  active ? "bg-purple-100 text-purple-700" : "text-neutral-700 hover:bg-neutral-100",
                )}
              >
                {f.label}
                <span className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] tabular-nums", active ? "bg-purple-500 text-white" : f.value === "late" ? "bg-red-50 text-red-700" : "bg-neutral-100 text-neutral-700")}>
                  {countOf(f.value)}
                </span>
              </button>
            );
          })}
        </div>
        {visible.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-6 text-center text-body-sm text-neutral-600">{actions.length ? "Nenhuma ação nesta situação." : "Nenhuma ação neste objetivo ainda."}</p>
        ) : (
          <ul aria-label={`Ações de ${goal.title}`} className="mt-4 divide-y divide-line rounded-lg border border-line">
            {visible.map((a) => (
              <ActionRow key={a.id} action={a} personId={personId} canUpdate={canUpdate} canCancel={canManage} />
            ))}
          </ul>
        )}
      </div>
      {editing ? <EditGoalDialog key={goal.id} goal={goal} competencies={competencyOptions} open onOpenChange={setEditing} /> : null}
    </section>
  );
}
