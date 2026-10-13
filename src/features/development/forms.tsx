"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/design-system/components/button";
import { RadioGroup } from "@/design-system/components/choice";
import { DatePicker } from "@/design-system/components/date-picker";
import { Modal } from "@/design-system/components/dialog";
import { Alert } from "@/design-system/components/feedback";
import { Field, Input, Textarea } from "@/design-system/components/field";
import { Select } from "@/design-system/components/select";
import { useToast } from "@/design-system/components/toast";
import { api, ApiError } from "@/lib/api-client";
import { ACTION_TYPE_LABEL, PROFICIENCY_SCALE } from "./labels";

/** Fluxo padrão dos formulários: envia, fecha, atualiza a página e confirma com toast. */
function useSubmit(onDone: () => void) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function submit(fn: () => Promise<unknown>, success: string) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        onDone();
        router.refresh();
        toast({ tone: "success", title: success });
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Não foi possível salvar. Tente novamente.");
      }
    });
  }
  return { error, pending, submit };
}

function FormFooter({ pending, onCancel, label }: { pending: boolean; onCancel: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <Button type="button" variant="ghost" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" loading={pending}>
        {label}
      </Button>
    </div>
  );
}

export function CreatePdiButton({ userId, personName }: { userId?: string; personName?: string }) {
  const year = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(`PDI ${year}`);
  const [start, setStart] = useState<string | null>(`${year}-01-01`);
  const [end, setEnd] = useState<string | null>(`${year}-12-31`);
  const { error, pending, submit } = useSubmit(() => setOpen(false));
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title={personName ? `Criar PDI de ${personName}` : "Criar meu PDI"}
      description="Defina o ciclo do plano. Depois, adicione metas e ações."
      trigger={
        <Button>
          <Plus aria-hidden /> {personName ? "Criar PDI" : "Criar meu PDI"}
        </Button>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(() => api("/api/v1/development/pdis", { method: "POST", body: { userId, title, periodStart: start, periodEnd: end } }), "PDI criado!");
        }}
      >
        {error ? <Alert tone="error" title={error} /> : null}
        <Field label="Nome do plano">{({ id }) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} required />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Início">{({ id }) => <DatePicker id={id} value={start} onChange={setStart} />}</Field>
          <Field label="Fim">{({ id }) => <DatePicker id={id} value={end} onChange={setEnd} min={start ?? undefined} />}</Field>
        </div>
        <FormFooter pending={pending} onCancel={() => setOpen(false)} label="Criar PDI" />
      </form>
    </Modal>
  );
}

/** "Liderança, Carreira" → ["Liderança", "Carreira"]. */
const parseTags = (text: string) =>
  text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

function TagsField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field label="Etiquetas (opcional)" hint="Separe por vírgula. Ex.: Carreira, Crescimento">
      {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={value} onChange={(e) => onChange(e.target.value)} maxLength={140} />}
    </Field>
  );
}

export function AddGoalButton({ pdiId, competencies, trigger }: { pdiId: string; competencies: { id: string; name: string }[]; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [competencyId, setCompetencyId] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const { error, pending, submit } = useSubmit(() => {
    setOpen(false);
    setTitle("");
    setDescription("");
    setTags("");
    setCompetencyId("");
    setTarget(null);
  });
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Nova meta de desenvolvimento"
      description="Uma meta é um objetivo; as ações mostram como chegar lá."
      trigger={
        trigger ?? (
          <Button variant="secondary" size="sm">
            <Plus aria-hidden /> Adicionar meta
          </Button>
        )
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(
            () =>
              api(`/api/v1/development/pdis/${pdiId}/goals`, {
                method: "POST",
                body: { title, description: description.trim() || null, competencyId: competencyId || null, targetDate: target, tags: parseTags(tags) },
              }),
            "Meta adicionada!",
          );
        }}
      >
        {error ? <Alert tone="error" title={error} /> : null}
        <Field label="Objetivo" hint="Ex.: Evoluir para uma posição de liderança">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />}
        </Field>
        <Field label="Competência relacionada">
          {({ id }) => (
            <Select id={id} value={competencyId} onChange={(e) => setCompetencyId(e.target.value)}>
              <option value="">Nenhuma</option>
              {competencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Descrição (opcional)">{({ id }) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} />}</Field>
        <Field label="Prazo da meta">{({ id }) => <DatePicker id={id} value={target} onChange={setTarget} />}</Field>
        <TagsField value={tags} onChange={setTags} />
        <FormFooter pending={pending} onCancel={() => setOpen(false)} label="Adicionar meta" />
      </form>
    </Modal>
  );
}

/** Nova ação numa meta. Com várias metas e nenhuma fixada, a pessoa escolhe a meta no formulário. */
export function AddActionButton({ goals, goalId: fixedGoalId, trigger }: { goals: { id: string; title: string }[]; goalId?: string; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [goalId, setGoalId] = useState(fixedGoalId ?? goals[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("pratica");
  const [due, setDue] = useState<string | null>(null);
  const { error, pending, submit } = useSubmit(() => {
    setOpen(false);
    setTitle("");
    setDue(null);
  });
  const fixed = fixedGoalId ? goals.find((g) => g.id === fixedGoalId) : goals.length === 1 ? goals[0] : undefined;
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Nova ação"
      description={fixed ? `Meta: ${fixed.title}` : "Escolha a meta e descreva a ação."}
      trigger={
        trigger ?? (
          <Button variant="tertiary" size="sm">
            <Plus aria-hidden /> Adicionar ação
          </Button>
        )
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const target = fixed?.id ?? goalId;
          submit(() => api(`/api/v1/development/goals/${target}/actions`, { method: "POST", body: { title, type, dueDate: due } }), "Ação adicionada!");
        }}
      >
        {error ? <Alert tone="error" title={error} /> : null}
        {fixed ? null : (
          <Field label="Meta">
            {({ id }) => (
              <Select id={id} value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="O que será feito?">{({ id }) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            {({ id }) => (
              <Select id={id} value={type} onChange={(e) => setType(e.target.value)}>
                {Object.entries(ACTION_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Prazo">{({ id }) => <DatePicker id={id} value={due} onChange={setDue} />}</Field>
        </div>
        <FormFooter pending={pending} onCancel={() => setOpen(false)} label="Adicionar ação" />
      </form>
    </Modal>
  );
}

/** Conclusão de ação com evidência opcional (texto e/ou link https). */
export function CompleteActionDialog({
  actionId,
  title,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  actionId: string;
  title: string;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;
  const [evidence, setEvidence] = useState("");
  const [url, setUrl] = useState("");
  const { error, pending, submit } = useSubmit(() => setOpen(false));
  return (
    <Modal open={open} onOpenChange={setOpen} title="Concluir ação" description={title} trigger={trigger}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(
            () => api(`/api/v1/development/actions/${actionId}`, { method: "PATCH", body: { status: "done", evidence: evidence.trim() || null, evidenceUrl: url.trim() || null } }),
            "Ação concluída! 🎉",
          );
        }}
      >
        {error ? <Alert tone="error" title={error} /> : null}
        <Field label="Evidência (opcional)" hint="Conte o que foi feito ou aprendido.">
          {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} value={evidence} onChange={(e) => setEvidence(e.target.value)} maxLength={2000} />}
        </Field>
        <Field label="Link da evidência (opcional)" hint="Apenas endereços https://">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />}
        </Field>
        <FormFooter pending={pending} onCancel={() => setOpen(false)} label="Concluir" />
      </form>
    </Modal>
  );
}

/** Avaliação de competência numa escala de 5 níveis (autoavaliação ou como gestor/G&G). */
export function AssessCompetencyButton({ userId, competencyId, competencyName, current, label }: { userId?: string; competencyId: string; competencyName: string; current: number | null; label: string }) {
  const [open, setOpen] = useState(false);
  const nearest = current === null ? "" : String(PROFICIENCY_SCALE.reduce((best, s) => (Math.abs(s.score - current) < Math.abs(best.score - current) ? s : best)).score);
  const [score, setScore] = useState(nearest);
  const [note, setNote] = useState("");
  const { error, pending, submit } = useSubmit(() => setOpen(false));
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title={`Avaliar: ${competencyName}`}
      description="Escolha o nível que melhor descreve o momento atual."
      trigger={
        <Button variant="tertiary" size="sm">
          {label}
        </Button>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!score) return;
          submit(() => api("/api/v1/development/assessments", { method: "POST", body: { userId, competencyId, score: Number(score), note: note.trim() || null } }), "Avaliação registrada!");
        }}
      >
        {error ? <Alert tone="error" title={error} /> : null}
        <RadioGroup aria-label="Nível" value={score} onValueChange={setScore} options={PROFICIENCY_SCALE.map((s) => ({ value: String(s.score), label: `${s.label} (${s.score}%)` }))} />
        <Field label="Comentário (opcional)">{({ id }) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />}</Field>
        <FormFooter pending={pending} onCancel={() => setOpen(false)} label="Registrar avaliação" />
      </form>
    </Modal>
  );
}

/** Edição de um objetivo pela liderança: título, descrição, competência, prazo e etiquetas. */
export function EditGoalDialog({
  goal,
  competencies,
  open,
  onOpenChange,
}: {
  goal: { id: string; title: string; description: string | null; competencyId: string | null; targetDate: string | null; tags: string[] };
  competencies: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description ?? "");
  const [competencyId, setCompetencyId] = useState(goal.competencyId ?? "");
  const [target, setTarget] = useState<string | null>(goal.targetDate);
  const [tags, setTags] = useState(goal.tags.join(", "));
  const { error, pending, submit } = useSubmit(() => onOpenChange(false));
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Editar objetivo" description="As mudanças aparecem para a pessoa no PDI dela.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(
            () =>
              api(`/api/v1/development/goals/${goal.id}`, {
                method: "PATCH",
                body: { title, description: description.trim() || null, competencyId: competencyId || null, targetDate: target, tags: parseTags(tags) },
              }),
            "Objetivo atualizado!",
          );
        }}
      >
        {error ? <Alert tone="error" title={error} /> : null}
        <Field label="Objetivo">{({ id }) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={140} />}</Field>
        <Field label="Descrição (opcional)">{({ id }) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Competência relacionada">
            {({ id }) => (
              <Select id={id} value={competencyId} onChange={(e) => setCompetencyId(e.target.value)}>
                <option value="">Nenhuma</option>
                {competencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Prazo">{({ id }) => <DatePicker id={id} value={target} onChange={setTarget} />}</Field>
        </div>
        <TagsField value={tags} onChange={setTags} />
        <FormFooter pending={pending} onCancel={() => onOpenChange(false)} label="Salvar" />
      </form>
    </Modal>
  );
}
