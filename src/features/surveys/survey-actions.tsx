"use client";

import { Copy, MoreVertical, Pause, Pencil, Play, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, IconButton } from "@/design-system/components/button";
import { Modal } from "@/design-system/components/dialog";
import { Alert } from "@/design-system/components/feedback";
import { Field, Input, Textarea } from "@/design-system/components/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/design-system/components/menu";
import { useToast } from "@/design-system/components/toast";
import { api, ApiError } from "@/lib/api-client";

export type ActionSurvey = { id: string; title: string; description?: string | null; status: "draft" | "active" | "paused" | "closed"; closesAt: Date | string | null };

type Dialog = "edit" | "resume" | "close" | "delete" | null;

/** "aaaa-mm-dd" (dia de Brasília) → encerramento às 23h59 desse dia. */
const endOfDay = (day: string) => `${day}T23:59:00-03:00`;
const dayOf = (date: Date | string | null) => (date ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(date)) : "");
const CONFIRM_WORD = "EXCLUIR";

/**
 * Ações da gestão sobre uma pesquisa: editar, pausar/retomar, encerrar,
 * duplicar e excluir. Depois do lançamento só título, descrição e prazo mudam
 * (perguntas e k ficam congelados para proteger o anonimato).
 */
export function SurveyActions({ survey, canDesign, canLaunch, layout = "menu" }: { survey: ActionSurvey; canDesign: boolean; canLaunch: boolean; layout?: "menu" | "buttons" }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(survey.title);
  const [description, setDescription] = useState(survey.description ?? "");
  const [closesOn, setClosesOn] = useState(dayOf(survey.closesAt));
  const [confirmText, setConfirmText] = useState("");
  const [minDate] = useState(() => dayOf(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const launched = survey.status !== "draft";
  const open = survey.status === "active" || survey.status === "paused";

  function run(fn: () => Promise<unknown>, success: string, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setDialog(null);
        toast({ tone: "success", title: success });
        if (after) after();
        else router.refresh();
      } catch (e) {
        const message = e instanceof ApiError ? e.message : "Tente novamente.";
        if (dialog) setError(message);
        else toast({ tone: "error", title: "Não foi possível concluir", description: message });
      }
    });
  }

  const show = (d: Dialog) => {
    setError(null);
    setConfirmText("");
    setTitle(survey.title);
    setDescription(survey.description ?? "");
    setClosesOn(dayOf(survey.closesAt));
    setDialog(d);
  };

  const pause = () => run(() => api(`/api/v1/surveys/${survey.id}/pause`, { method: "POST" }), "Pesquisa pausada");
  const duplicate = () =>
    run(
      () => api<{ id: string }>(`/api/v1/surveys/${survey.id}/duplicate`, { method: "POST" }).then((r) => router.push(`/gestao/pesquisas/${r.id}` as Route)),
      "Cópia criada como rascunho",
      () => undefined,
    );

  const items = (
    <>
      {canDesign && !launched ? (
        <MenuItem asChild>
          <Link href={`/gestao/pesquisas/${survey.id}` as Route}>
            <Pencil aria-hidden /> Editar rascunho
          </Link>
        </MenuItem>
      ) : null}
      {launched && (canDesign || (canLaunch && open)) ? (
        <MenuItem onSelect={() => show("edit")}>
          <Pencil aria-hidden /> Editar informações
        </MenuItem>
      ) : null}
      {canLaunch && survey.status === "active" ? (
        <MenuItem onSelect={pause}>
          <Pause aria-hidden /> Pausar respostas
        </MenuItem>
      ) : null}
      {canLaunch && survey.status === "paused" ? (
        <MenuItem onSelect={() => show("resume")}>
          <Play aria-hidden /> Retomar respostas
        </MenuItem>
      ) : null}
      {canLaunch && open ? (
        <MenuItem onSelect={() => show("close")}>
          <Square aria-hidden /> Encerrar pesquisa
        </MenuItem>
      ) : null}
      {canDesign ? (
        <MenuItem onSelect={duplicate}>
          <Copy aria-hidden /> Duplicar
        </MenuItem>
      ) : null}
      {canDesign && (!launched || canLaunch) ? (
        <>
          <MenuSeparator />
          <MenuItem onSelect={() => show("delete")} className="text-red-700 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700">
            <Trash2 aria-hidden /> Excluir
          </MenuItem>
        </>
      ) : null}
    </>
  );

  if (!canDesign && !canLaunch) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {layout === "buttons" && canLaunch && survey.status === "active" ? (
          <Button variant="ghost" loading={pending} onClick={pause}>
            <Pause aria-hidden /> Pausar
          </Button>
        ) : null}
        {layout === "buttons" && canLaunch && survey.status === "paused" ? (
          <Button onClick={() => show("resume")}>
            <Play aria-hidden /> Retomar
          </Button>
        ) : null}
        {layout === "buttons" && canLaunch && open ? (
          <Button variant="ghost" onClick={() => show("close")}>
            <Square aria-hidden /> Encerrar
          </Button>
        ) : null}
        <Menu>
          <MenuTrigger asChild>
            <IconButton label={`Ações da pesquisa ${survey.title}`} variant={layout === "menu" ? "plain" : "outline"} size={layout === "menu" ? "sm" : "md"} disabled={pending}>
              <MoreVertical />
            </IconButton>
          </MenuTrigger>
          <MenuContent align="end">{items}</MenuContent>
        </Menu>
      </div>

      <Modal
        open={dialog === "edit"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="Editar informações"
        description="Perguntas e k ficam congelados depois do lançamento, para proteger o anonimato."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                run(
                  () =>
                    api(`/api/v1/surveys/${survey.id}`, {
                      method: "PATCH",
                      body: {
                        ...(canDesign ? { title, description: description.trim() || null } : {}),
                        ...(canLaunch && open && closesOn && closesOn !== dayOf(survey.closesAt) ? { closesAt: endOfDay(closesOn) } : {}),
                      },
                    }),
                  "Pesquisa atualizada",
                )
              }
            >
              Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert tone="error" title={error} /> : null}
          {canDesign ? (
            <>
              <Field label="Título">{(f) => <Input id={f.id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />}</Field>
              <Field label="Descrição (opcional)">{(f) => <Textarea id={f.id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} rows={3} />}</Field>
            </>
          ) : null}
          {canLaunch && open ? (
            <Field label="Recebe respostas até" hint="Encerra às 23h59 (horário de Brasília) deste dia.">
              {(f) => <Input id={f.id} aria-describedby={f.describedBy} type="date" min={minDate} value={closesOn} onChange={(e) => setClosesOn(e.target.value)} />}
            </Field>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={dialog === "resume"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="Retomar respostas"
        description="As pessoas voltam a poder responder. Ajuste o prazo se precisar."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                run(
                  () => api(`/api/v1/surveys/${survey.id}/resume`, { method: "POST", body: closesOn && closesOn !== dayOf(survey.closesAt) ? { closesAt: endOfDay(closesOn) } : {} }),
                  "Pesquisa retomada",
                )
              }
            >
              <Play aria-hidden /> Retomar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert tone="error" title={error} /> : null}
          <Field label="Recebe respostas até" hint="Encerra às 23h59 (horário de Brasília) deste dia.">
            {(f) => <Input id={f.id} aria-describedby={f.describedBy} type="date" min={minDate} value={closesOn} onChange={(e) => setClosesOn(e.target.value)} />}
          </Field>
        </div>
      </Modal>

      <Modal
        open={dialog === "close"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="Encerrar pesquisa?"
        description="Ninguém mais poderá responder e o último lote de respostas é liberado nos resultados. Não dá para reabrir."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button loading={pending} onClick={() => run(() => api(`/api/v1/surveys/${survey.id}/close`, { method: "POST" }), "Pesquisa encerrada")}>
              <Square aria-hidden /> Encerrar agora
            </Button>
          </>
        }
      >
        {error ? <Alert tone="error" title={error} /> : null}
      </Modal>

      <Modal
        open={dialog === "delete"}
        onOpenChange={(v) => !v && setDialog(null)}
        title={launched ? "Excluir pesquisa e respostas?" : "Excluir rascunho?"}
        description={survey.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              loading={pending}
              disabled={launched && confirmText.trim().toUpperCase() !== CONFIRM_WORD}
              onClick={() => run(() => api(`/api/v1/surveys/${survey.id}`, { method: "DELETE" }), "Pesquisa excluída", () => router.push("/gestao/pesquisas"))}
            >
              <Trash2 aria-hidden /> Excluir
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert tone="error" title={error} /> : null}
          {launched ? (
            <>
              <Alert tone="warning" title="Esta ação não pode ser desfeita">
                A pesquisa, os convites e todas as respostas anônimas serão apagados de vez, e os resultados deixam de existir.
              </Alert>
              <Field label={`Digite ${CONFIRM_WORD} para confirmar`}>{(f) => <Input id={f.id} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />}</Field>
            </>
          ) : (
            <p className="text-body-sm text-neutral-700">O rascunho e as perguntas serão apagados.</p>
          )}
        </div>
      </Modal>
    </>
  );
}
