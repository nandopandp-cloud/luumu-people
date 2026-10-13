"use client";

import { ChevronDown, ChevronsDownUp, ChevronsUpDown, ClipboardList, MoreHorizontal, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { Button, IconButton } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/design-system/components/menu";
import { cn } from "@/design-system/cn";
import type { PdiGoal } from "@/server/modules/development/service";
import { ActionRow } from "./action-row";
import { AddActionButton, EditGoalDialog } from "./forms";
import { formatDay } from "./labels";
import { CompetencyIcon } from "./side-cards";

type Props = {
  goals: PdiGoal[];
  personId: string;
  isSelf: boolean;
  canUpdate: boolean;
  canManage: boolean;
  competencyOptions: { id: string; name: string }[];
  pdiHref: Route;
};

/** "Meus objetivos de desenvolvimento": cada objetivo com as ações, recolhível. */
export function GoalsAccordion({ goals, personId, isSelf, canUpdate, canManage, competencyOptions, pdiHref }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<PdiGoal | null>(null);
  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section aria-labelledby="objetivos-titulo" className="min-w-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="objetivos-titulo" className="text-h2 font-bold tracking-[-0.01em] text-neutral-900">
            {isSelf ? "Meus objetivos de desenvolvimento" : "Objetivos de desenvolvimento"}
          </h2>
          <p className="mt-0.5 text-body-sm text-neutral-600">Acompanhe as ações, os prazos e a evolução em cada objetivo.</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && goals.length ? (
            <AddActionButton
              goals={goals}
              trigger={
                <Button>
                  <Plus aria-hidden /> Nova ação
                </Button>
              }
            />
          ) : null}
          <Menu>
            <MenuTrigger asChild>
              <IconButton label="Mais opções dos objetivos">
                <MoreHorizontal />
              </IconButton>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem onSelect={() => setCollapsed(new Set())}>
                <ChevronsUpDown aria-hidden /> Expandir todos
              </MenuItem>
              <MenuItem onSelect={() => setCollapsed(new Set(goals.map((g) => g.id)))}>
                <ChevronsDownUp aria-hidden /> Recolher todos
              </MenuItem>
              <MenuItem asChild>
                <Link href={pdiHref}>
                  <ClipboardList aria-hidden /> {isSelf ? "Abrir meu PDI" : "Abrir o PDI"}
                </Link>
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-xl border border-line bg-white shadow-sm">
          <EmptyState compact title="Nenhum objetivo ainda" description={isSelf ? "Os objetivos do seu PDI são definidos com a sua liderança." : "Defina o primeiro objetivo no PDI."} />
        </div>
      ) : (
        <ul className="space-y-4">
          {goals.map((goal) => {
            const open = !collapsed.has(goal.id);
            const panelId = `objetivo-${goal.id}`;
            return (
              <li key={goal.id}>
                <article aria-labelledby={`${panelId}-titulo`} className="rounded-xl border border-line bg-white shadow-sm">
                  <header className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
                    <IconButton label={open ? `Recolher ${goal.title}` : `Expandir ${goal.title}`} variant="plain" size="sm" aria-expanded={open} aria-controls={panelId} onClick={() => toggle(goal.id)} className="text-neutral-500">
                      <ChevronDown className={cn("transition-transform", !open && "-rotate-90")} />
                    </IconButton>
                    <CompetencyIcon icon={goal.competencyIcon} className="size-12 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <h3 id={`${panelId}-titulo`} className="text-body font-bold text-neutral-900">
                        {goal.title}
                      </h3>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-neutral-600">
                        {goal.competencyName ? <span className="rounded-md bg-purple-50 px-2 py-0.5 font-semibold text-purple-700">{goal.competencyName}</span> : null}
                        <span>Prazo: {formatDay(goal.targetDate)}</span>
                      </p>
                    </div>
                    <div className="hidden w-40 items-center gap-3 sm:flex">
                      <div role="progressbar" aria-label={`Progresso de ${goal.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={goal.progress} className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400" style={{ width: `${goal.progress}%` }} />
                      </div>
                      <span className="w-9 text-right text-caption font-semibold tabular-nums text-neutral-700">{goal.progress}%</span>
                    </div>
                    <span aria-hidden className="text-caption font-semibold tabular-nums text-neutral-700 sm:hidden">
                      {goal.progress}%
                    </span>
                  </header>
                  <div id={panelId} hidden={!open} className="border-t border-line">
                    {goal.actions.length === 0 ? (
                      <p className="px-5 py-4 text-body-sm text-neutral-600">Nenhuma ação neste objetivo ainda.</p>
                    ) : (
                      <ul aria-label={`Ações de ${goal.title}`} className="divide-y divide-line sm:pl-12">
                        {goal.actions.map((a) => (
                          <ActionRow key={a.id} action={a} personId={personId} canUpdate={canUpdate} canCancel={canManage} />
                        ))}
                      </ul>
                    )}
                    {canManage ? (
                      <footer className="flex flex-wrap gap-2 border-t border-line px-5 py-2 sm:pl-16">
                        <AddActionButton goals={goals} goalId={goal.id} />
                        <Button variant="tertiary" size="sm" onClick={() => setEditing(goal)}>
                          <Pencil aria-hidden /> Editar objetivo
                        </Button>
                      </footer>
                    ) : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
      {editing ? <EditGoalDialog key={editing.id} goal={editing} competencies={competencyOptions} open onOpenChange={(open) => !open && setEditing(null)} /> : null}
    </section>
  );
}
