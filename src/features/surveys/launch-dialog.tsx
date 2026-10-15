"use client";

import { CalendarClock, Rocket, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/design-system/components/button";
import { RadioGroup } from "@/design-system/components/choice";
import { DatePicker } from "@/design-system/components/date-picker";
import { Modal } from "@/design-system/components/dialog";
import { Alert } from "@/design-system/components/feedback";
import { Field } from "@/design-system/components/field";
import { Select } from "@/design-system/components/select";
import { api } from "@/lib/api-client";

export type LaunchBody = { closesAt: string; opensAt?: string; audienceOrgUnitId?: string | null };
type OrgUnit = { id: string; name: string; type: string };

const num = new Intl.NumberFormat("pt-BR");
const brDate = (iso: string) => iso.split("-").reverse().join("/");
/** Dia (aaaa-mm-dd) em Brasília, deslocado em `days`. */
const dayFromToday = (days: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + days * 86_400_000));
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Lançamento: público (empresa toda ou uma área com subáreas), início (agora ou
 * agendado) e prazo. O público precisa de ao menos k pessoas (anonimato).
 */
export function LaunchDialog({
  open,
  onOpenChange,
  k,
  orgUnits,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  k: number;
  orgUnits: OrgUnit[];
  pending: boolean;
  onConfirm: (body: LaunchBody) => void;
}) {
  const [audience, setAudience] = useState("");
  const [size, setSize] = useState<{ key: string; size: number; k: number } | null>(null);
  const [startMode, setStartMode] = useState<"now" | "scheduled">("now");
  const [opensOn, setOpensOn] = useState<string | null>(null);
  const [closesOn, setClosesOn] = useState<string | null>(null);

  // Tamanho do público ao abrir e a cada troca de área.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    api<{ size: number; k: number }>(`/api/v1/surveys/audience${audience ? `?orgUnitId=${audience}` : ""}`)
      .then((r) => alive && setSize({ key: audience, ...r }))
      .catch(() => alive && setSize(null));
    return () => {
      alive = false;
    };
  }, [open, audience]);

  const scheduled = startMode === "scheduled";
  const minOpen = dayFromToday(1);
  const minClose = scheduled && opensOn ? addDays(opensOn, 1) : dayFromToday(1);
  const current = size && size.key === audience ? size : null;
  const required = Math.max(k, current?.k ?? 0);
  const tooSmall = current !== null && current.size < required;
  const closeInvalid = Boolean(closesOn && closesOn < minClose);
  const ready = Boolean(closesOn) && !closeInvalid && (!scheduled || Boolean(opensOn)) && current !== null && !tooSmall;
  const unitName = orgUnits.find((u) => u.id === audience)?.name;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Lançar pesquisa"
      description="Escolha quem responde e quando a pesquisa abre e fecha."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!ready}
            loading={pending}
            onClick={() =>
              onConfirm({
                // Encerra às 23h59 e abre à 0h (horário de Brasília).
                closesAt: `${closesOn}T23:59:00-03:00`,
                ...(scheduled && opensOn ? { opensAt: `${opensOn}T00:00:00-03:00` } : {}),
                audienceOrgUnitId: audience || null,
              })
            }
          >
            {scheduled ? <CalendarClock aria-hidden /> : <Rocket aria-hidden />} {scheduled ? "Agendar pesquisa" : "Lançar agora"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Público" hint="Pessoas ativas da área escolhida, incluindo as subáreas.">
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="">Toda a empresa</option>
              {orgUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.type === "directorate" ? u.name : `— ${u.name}`}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <p className="flex items-center gap-2 rounded-lg bg-purple-50 px-4 py-2.5 text-body-sm text-purple-700" aria-live="polite">
          <UsersRound aria-hidden className="size-4 shrink-0" />
          {current === null ? "Calculando o público…" : `${num.format(current.size)} ${current.size === 1 ? "pessoa será convidada" : "pessoas serão convidadas"}${unitName ? ` em ${unitName}` : ""}.`}
        </p>
        {tooSmall ? (
          <Alert tone="warning" title={`O público precisa ter ao menos ${required} pessoas`}>
            Com menos gente, as respostas poderiam identificar quem respondeu. Escolha uma área maior ou a empresa toda.
          </Alert>
        ) : null}

        <fieldset className="space-y-3">
          <legend className="mb-2 text-body-sm font-semibold text-neutral-800">Início</legend>
          <RadioGroup
            aria-label="Início"
            value={startMode}
            onValueChange={(v) => setStartMode(v as "now" | "scheduled")}
            options={[
              { value: "now", label: "Começar agora" },
              { value: "scheduled", label: "Agendar o início" },
            ]}
          />
          {scheduled ? (
            <Field label="Abre em" hint="A pesquisa abre à 0h (horário de Brasília) deste dia. Até lá, ninguém vê nem responde.">
              {({ id, describedBy }) => <DatePicker id={id} aria-describedby={describedBy} value={opensOn} onChange={setOpensOn} min={minOpen} max={dayFromToday(180)} />}
            </Field>
          ) : null}
        </fieldset>

        <Field label="Recebe respostas até" hint="Encerra às 23h59 (horário de Brasília) deste dia." error={closeInvalid ? "O encerramento precisa ser depois do início." : null}>
          {({ id, describedBy, invalid }) => <DatePicker id={id} aria-describedby={describedBy} invalid={invalid} value={closesOn} onChange={setClosesOn} min={minClose} />}
        </Field>

        {closesOn && !closeInvalid && (!scheduled || opensOn) ? (
          <p className="text-body-sm text-neutral-700">
            {scheduled && opensOn ? `Abre em ${brDate(opensOn)} e recebe respostas até ${brDate(closesOn)}.` : `Abre agora e recebe respostas até ${brDate(closesOn)}.`}
          </p>
        ) : null}

        <Alert tone="warning" title="Depois do lançamento, nada disso muda">
          Público, perguntas, k ({k}) e os grupos de segmentação ficam congelados para proteger o anonimato. Os resultados aparecem em lotes de pelo menos {k} respostas.
        </Alert>
      </div>
    </Modal>
  );
}
