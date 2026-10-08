import { AlarmClock, CalendarDays, CircleCheck, Paperclip, Target } from "lucide-react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { Progress } from "@/design-system/components/progress";
import { cn } from "@/design-system/cn";
import type { Development } from "@/server/modules/development/service";
import { ActionStatusSelect } from "./action-status";
import { AddActionButton, AddGoalButton, CompleteActionDialog, CreatePdiButton } from "./forms";
import { ACTION_TYPE_LABEL, formatDay } from "./labels";

/** PDI completo: metas, ações, status, prazos e evidências. Controles só para quem pode alterar. */
export function PdiBoard({ development, managedUserId }: { development: Development; managedUserId?: string }) {
  const { pdi, canManage, competencyOptions, isSelf, person } = development;
  if (!pdi) {
    return (
      <Card>
        <EmptyState
          title={isSelf ? "Você ainda não tem um PDI ativo" : `${person.name.split(" ")[0]} ainda não tem um PDI ativo`}
          description="O Plano de Desenvolvimento Individual organiza metas e ações para evoluir na carreira."
          action={canManage ? <CreatePdiButton userId={managedUserId} personName={isSelf ? undefined : person.name.split(" ")[0]} /> : null}
        />
      </Card>
    );
  }
  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-h3 font-bold text-neutral-900">{pdi.title}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-body-sm text-neutral-600">
            <CalendarDays aria-hidden className="size-4" /> {formatDay(pdi.periodStart)} a {formatDay(pdi.periodEnd)}
          </p>
        </div>
        <div className="w-full max-w-xs">
          <Progress value={pdi.stats.progress} label="Progresso do PDI" />
          <p className="mt-1 text-caption text-neutral-600">
            {pdi.stats.actionsDone} de {pdi.stats.actionsTotal} ações concluídas
            {pdi.stats.actionsLate ? <span className="font-medium text-red-600"> · {pdi.stats.actionsLate} atrasada{pdi.stats.actionsLate > 1 ? "s" : ""}</span> : null}
          </p>
        </div>
        {canManage ? <AddGoalButton pdiId={pdi.id} competencies={competencyOptions} /> : null}
      </Card>

      {pdi.goals.length === 0 ? (
        <Card>
          <EmptyState compact title="Nenhuma meta ainda" description="Comece definindo um objetivo de desenvolvimento." />
        </Card>
      ) : null}

      {pdi.goals.map((goal) => (
        <Card key={goal.id} as="article" className="p-0">
          <header className="flex flex-wrap items-start gap-4 border-b border-line p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-500">
              <Target aria-hidden className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-h4 font-semibold text-neutral-900">{goal.title}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-caption text-neutral-600">
                {goal.competencyName ? <Badge tone="purple">{goal.competencyName}</Badge> : null}
                <span>Prazo: {formatDay(goal.targetDate)}</span>
              </div>
            </div>
            <div className="w-44">
              <Progress value={goal.progress} label={`Progresso da meta ${goal.title}`} />
            </div>
          </header>
          {goal.actions.length === 0 ? (
            <p className="px-5 py-4 text-body-sm text-neutral-600">Nenhuma ação nesta meta.</p>
          ) : (
            <ul className="divide-y divide-line">
              {goal.actions.map((a) => (
                <li key={a.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3.5", a.status === "cancelled" && "opacity-60")}>
                  {a.status === "done" ? <CircleCheck aria-label="Concluída" className="size-5 shrink-0 text-green-600" /> : <span aria-hidden className="size-5 shrink-0 rounded-full border-2 border-neutral-300" />}
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-body-sm font-medium text-neutral-900", a.status === "done" && "text-neutral-600")}>{a.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-neutral-600">
                      <span>{ACTION_TYPE_LABEL[a.type] ?? a.type}</span>
                      <span className={cn("flex items-center gap-1", a.late && "font-medium text-red-600")}>
                        <AlarmClock aria-hidden className="size-3.5" />
                        {a.late ? `Atrasada · ${formatDay(a.dueDate)}` : formatDay(a.dueDate)}
                      </span>
                      <span>Responsável: {a.ownerName}</span>
                      {a.evidence || a.evidenceUrl ? (
                        <span className="flex items-center gap-1">
                          <Paperclip aria-hidden className="size-3.5" />
                          {a.evidenceUrl ? (
                            <a href={a.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-purple-600 underline underline-offset-2">
                              Evidência
                            </a>
                          ) : (
                            <span title={a.evidence ?? undefined}>Com evidência</span>
                          )}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      {a.status !== "done" && a.status !== "cancelled" ? (
                        <CompleteActionDialog
                          actionId={a.id}
                          title={a.title}
                          trigger={
                            <Button variant="soft" size="sm">
                              <CircleCheck aria-hidden /> Concluir
                            </Button>
                          }
                        />
                      ) : null}
                      <ActionStatusSelect actionId={a.id} status={a.status} title={a.title} />
                    </div>
                  ) : (
                    <Badge tone={a.status === "done" ? "green" : a.late ? "red" : "neutral"}>{a.status === "done" ? "Concluída" : a.late ? "Atrasada" : "Em aberto"}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <footer className="border-t border-line px-5 py-2">
              <AddActionButton goalId={goal.id} goalTitle={goal.title} />
            </footer>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
