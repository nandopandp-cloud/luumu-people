"use client";

import { CalendarDays, CircleCheck, CirclePlay, CircleX, FileText, MoreVertical, Paperclip, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, IconButton } from "@/design-system/components/button";
import { Modal } from "@/design-system/components/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/design-system/components/menu";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { api } from "@/lib/api-client";
import type { PdiAction } from "@/server/modules/development/service";
import { CompleteActionDialog } from "./forms";
import { ACTION_TYPE_ICON, ACTION_TYPE_LABEL, DISPLAY_STATUS, displayStatus, formatDay } from "./labels";

/** Ícone de situação à esquerda: concluída (verde), atrasada (aro vermelho) ou aberta (aro cinza). */
function StatusMark({ action }: { action: PdiAction }) {
  const status = displayStatus(action);
  if (status === "done") return <CircleCheck aria-label="Concluída" className="size-6 shrink-0 fill-green-500 text-white" />;
  return (
    <span
      role="img"
      aria-label={DISPLAY_STATUS[status].label}
      className={cn("size-5 shrink-0 rounded-full border-2", status === "late" ? "border-red-500" : status === "cancelled" ? "border-neutral-200" : "border-neutral-300")}
    />
  );
}

/**
 * Ação do PDI: situação, tipo, prazo, evidência e o menu "⋮" (andamento,
 * concluir com evidência, ver evidência; cancelar só para a liderança).
 */
export function ActionRow({ action, personId, canUpdate, canCancel }: { action: PdiAction; personId: string; canUpdate: boolean; canCancel: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [completing, setCompleting] = useState(false);
  const [viewing, setViewing] = useState(false);
  const status = displayStatus(action);
  const chip = DISPLAY_STATUS[status];
  const TypeIcon = ACTION_TYPE_ICON[action.type] ?? FileText;
  const hasEvidence = Boolean(action.evidence || action.evidenceUrl);

  function setStatus(next: "not_started" | "in_progress" | "cancelled", success: string) {
    startTransition(async () => {
      try {
        await api(`/api/v1/development/actions/${action.id}`, { method: "PATCH", body: { status: next } });
        router.refresh();
        toast({ tone: "success", title: success });
      } catch {
        toast({ tone: "error", title: "Não foi possível atualizar a ação." });
      }
    });
  }

  return (
    <li className={cn("flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5", action.status === "cancelled" && "opacity-60")}>
      <StatusMark action={action} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-body-sm font-medium text-neutral-900", action.status === "cancelled" && "line-through")}>{action.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-neutral-600">
          <span className="inline-flex items-center gap-1">
            <TypeIcon aria-hidden className="size-3.5" />
            {ACTION_TYPE_LABEL[action.type] ?? action.type}
          </span>
          <span className={cn("inline-flex items-center gap-1", status === "late" && "font-medium text-red-700")}>
            <CalendarDays aria-hidden className="size-3.5" />
            <span className="sr-only">Prazo:</span>
            {formatDay(action.dueDate)}
          </span>
          {hasEvidence ? (
            <span className="inline-flex items-center gap-1">
              <Paperclip aria-hidden className="size-3.5" /> Com evidência
            </span>
          ) : null}
          {action.ownerUserId !== personId ? <span>Responsável: {action.ownerName}</span> : null}
          {/* A situação já está no rótulo do ícone à esquerda: o selo é só visual. */}
          <span aria-hidden className={cn("rounded-full px-2 py-0.5 font-semibold sm:hidden", chip.chip)}>
            {chip.label}
          </span>
        </p>
      </div>
      <span aria-hidden className={cn("hidden shrink-0 rounded-full px-3 py-1 text-caption font-semibold sm:inline-flex", chip.chip)}>
        {chip.label}
      </span>
      {canUpdate || hasEvidence ? (
        <Menu>
          <MenuTrigger asChild>
            <IconButton label={`Opções da ação ${action.title}`} variant="plain" size="sm" disabled={pending} className="text-neutral-600">
              <MoreVertical />
            </IconButton>
          </MenuTrigger>
          <MenuContent align="end">
            {canUpdate && action.status !== "done" && action.status !== "cancelled" ? (
              <>
                <MenuItem onSelect={() => setCompleting(true)}>
                  <CircleCheck aria-hidden /> Concluir
                </MenuItem>
                {action.status === "not_started" ? (
                  <MenuItem onSelect={() => setStatus("in_progress", "Ação em andamento.")}>
                    <CirclePlay aria-hidden /> Marcar como em andamento
                  </MenuItem>
                ) : (
                  <MenuItem onSelect={() => setStatus("not_started", "Ação marcada como não iniciada.")}>
                    <RotateCcw aria-hidden /> Marcar como não iniciada
                  </MenuItem>
                )}
              </>
            ) : null}
            {canUpdate && action.status === "done" ? (
              <MenuItem onSelect={() => setStatus("in_progress", "Ação reaberta.")}>
                <RotateCcw aria-hidden /> Reabrir ação
              </MenuItem>
            ) : null}
            {hasEvidence ? (
              <MenuItem onSelect={() => setViewing(true)}>
                <Paperclip aria-hidden /> Ver evidência
              </MenuItem>
            ) : null}
            {canCancel && action.status !== "cancelled" && action.status !== "done" ? (
              <>
                <MenuSeparator />
                <MenuItem onSelect={() => setStatus("cancelled", "Ação cancelada.")} className="text-red-700 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700">
                  <CircleX aria-hidden /> Cancelar ação
                </MenuItem>
              </>
            ) : null}
          </MenuContent>
        </Menu>
      ) : null}
      {completing ? <CompleteActionDialog actionId={action.id} title={action.title} open={completing} onOpenChange={setCompleting} /> : null}
      <Modal
        open={viewing}
        onOpenChange={setViewing}
        title="Evidência"
        description={action.title}
        footer={
          <Button variant="ghost" onClick={() => setViewing(false)}>
            Fechar
          </Button>
        }
      >
        {action.evidence ? <p className="whitespace-pre-line text-body-sm text-neutral-800">{action.evidence}</p> : null}
        {action.evidenceUrl ? (
          <a href={action.evidenceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 break-all text-body-sm font-medium text-purple-600 underline underline-offset-2">
            <Paperclip aria-hidden className="size-4" /> {action.evidenceUrl}
          </a>
        ) : null}
      </Modal>
    </li>
  );
}
