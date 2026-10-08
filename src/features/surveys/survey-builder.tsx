"use client";

import { ArrowDown, ArrowUp, Plus, Rocket, Trash2, Wand2 } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, IconButton } from "@/design-system/components/button";
import { Checkbox } from "@/design-system/components/choice";
import { Modal } from "@/design-system/components/dialog";
import { Alert } from "@/design-system/components/feedback";
import { Field, Input, Textarea } from "@/design-system/components/field";
import { Select } from "@/design-system/components/select";
import { useToast } from "@/design-system/components/toast";
import { api, ApiError } from "@/lib/api-client";
import { QUESTION_TYPE_LABEL, SURVEY_KIND } from "./labels";
import { SURVEY_TEMPLATES, type TemplateQuestion } from "./templates";

type Kind = "climate" | "enps" | "pulse" | "custom";
type Question = TemplateQuestion & { key: string; optionsText: string };
export type BuilderSurvey = { id: string; title: string; description: string | null; kind: Kind; anonymityK: number; questions: TemplateQuestion[] };

let counter = 0;
const withKey = (q: TemplateQuestion): Question => ({ ...q, key: `q${++counter}`, optionsText: (q.options ?? []).join("\n") });
const blank = (): Question => withKey({ type: "scale", text: "", required: true });

/**
 * Builder de pesquisa (rascunho). Toda pesquisa é ANÔNIMA nesta versão. Depois
 * do lançamento, perguntas, k e dimensões congelam (garantido no banco).
 */
export function SurveyBuilder({ survey, organizationK, canDesign, canLaunch }: { survey?: BuilderSurvey; organizationK: number; canDesign: boolean; canLaunch: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState(survey?.title ?? "");
  const [description, setDescription] = useState(survey?.description ?? "");
  const [kind, setKind] = useState<Kind>(survey?.kind ?? "climate");
  const [k, setK] = useState(Math.max(survey?.anonymityK ?? organizationK, organizationK));
  const [questions, setQuestions] = useState<Question[]>(() => (survey?.questions.length ? survey.questions.map(withKey) : SURVEY_TEMPLATES.climate.map(withKey)));
  const [error, setError] = useState<string | null>(null);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [closesOn, setClosesOn] = useState("");
  const [pending, startTransition] = useTransition();
  // Amanhã (data local) como menor encerramento possível.
  const [minDate] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

  const updateQuestion = (key: string, patch: Partial<Question>) => setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const move = (index: number, delta: number) =>
    setQuestions((qs) => {
      const next = [...qs];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item!);
      return next;
    });

  function payload() {
    return {
      title,
      description: description.trim() || null,
      kind,
      anonymityK: k,
      questions: questions.map((q) => ({
        type: q.type,
        text: q.text,
        required: q.required,
        options: q.type === "choice" ? q.optionsText.split("\n").map((o) => o.trim()).filter(Boolean) : null,
      })),
    };
  }

  function run(action: () => Promise<void>, success: string) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        toast({ tone: "success", title: success });
      } catch (e) {
        setError(e instanceof ApiError ? [e.message, ...e.fieldErrors.map((f) => f.message)].filter((m, i, all) => all.indexOf(m) === i).join(" ") : "Não foi possível concluir. Tente novamente.");
      }
    });
  }

  async function save(): Promise<string> {
    if (survey) {
      await api(`/api/v1/surveys/${survey.id}`, { method: "PUT", body: payload() });
      return survey.id;
    }
    const { id } = await api<{ id: string }>("/api/v1/surveys", { method: "POST", body: payload() });
    return id;
  }

  const saveDraft = () =>
    run(async () => {
      const id = await save();
      if (!survey) router.push(`/gestao/pesquisas/${id}` as Route);
      router.refresh();
    }, survey ? "Rascunho salvo" : "Pesquisa criada");

  const launch = () =>
    run(async () => {
      const id = canDesign ? await save() : survey!.id;
      // Encerra ao fim do dia escolhido (horário de Brasília).
      await api(`/api/v1/surveys/${id}/launch`, { method: "POST", body: { closesAt: `${closesOn}T23:59:00-03:00` } });
      setLaunchOpen(false);
      router.push(`/gestao/pesquisas/${id}` as Route);
      router.refresh();
    }, "Pesquisa lançada");

  const remove = () => {
    if (!survey || !window.confirm("Excluir este rascunho de pesquisa?")) return;
    run(async () => {
      await api(`/api/v1/surveys/${survey.id}`, { method: "DELETE" });
      router.push("/gestao/pesquisas" as Route);
      router.refresh();
    }, "Rascunho excluído");
  };

  const applyTemplate = (template: "climate" | "enps" | "pulse") => {
    if (questions.some((q) => q.text.trim()) && !window.confirm("Substituir as perguntas atuais pelo modelo?")) return;
    setQuestions(SURVEY_TEMPLATES[template].map(withKey));
    setKind(template);
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        saveDraft();
      }}
    >
      <fieldset disabled={!canDesign || pending} className="space-y-5">
        <section className="card space-y-5 p-6" aria-labelledby="dados-pesquisa">
          <h2 id="dados-pesquisa" className="text-h3 font-bold text-neutral-900">
            Sobre a pesquisa
          </h2>
          <Field label="Título">{(f) => <Input id={f.id} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} required />}</Field>
          <Field label="Descrição" hint="Explique o objetivo e quanto tempo leva. Aparece para quem vai responder.">
            {(f) => <Textarea id={f.id} aria-describedby={f.describedBy} value={description} maxLength={600} rows={3} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo">
              {(f) => (
                <Select id={f.id} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                  {Object.entries(SURVEY_KIND).map(([value, item]) => (
                    <option key={value} value={value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Mínimo de respostas por grupo (k)" hint={`Grupos com menos respostas nunca aparecem. Mínimo da empresa: ${organizationK}.`}>
              {(f) => (
                <Select id={f.id} aria-describedby={f.describedBy} value={k} onChange={(e) => setK(Number(e.target.value))}>
                  {[5, 7, 10]
                    .filter((v) => v >= organizationK)
                    .map((v) => (
                      <option key={v} value={v}>
                        {v} pessoas
                      </option>
                    ))}
                </Select>
              )}
            </Field>
          </div>
          <Alert tone="info" title="Pesquisa anônima">
            As respostas não ficam ligadas a ninguém e os resultados só aparecem agregados, em grupos com pelo menos {k} respostas.
          </Alert>
        </section>

        <section className="card p-6" aria-labelledby="perguntas">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="perguntas" className="text-h3 font-bold text-neutral-900">
              Perguntas <span className="font-semibold text-neutral-500">({questions.length})</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Wand2 aria-hidden className="size-4 text-purple-500" />
              <span className="text-body-sm text-neutral-600">Usar modelo:</span>
              {(["climate", "enps", "pulse"] as const).map((t) => (
                <Button key={t} type="button" variant="soft" size="sm" onClick={() => applyTemplate(t)}>
                  {SURVEY_KIND[t]!.label}
                </Button>
              ))}
            </div>
          </div>
          <ol className="space-y-4">
            {questions.map((q, i) => (
              <li key={q.key} className="rounded-xl border border-line p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-purple-100 text-caption font-bold text-purple-600">{i + 1}</span>
                  <span className="text-body-sm font-medium text-neutral-700">{QUESTION_TYPE_LABEL[q.type]}</span>
                  <span className="ml-auto flex gap-1">
                    <IconButton label={`Mover pergunta ${i + 1} para cima`} size="sm" variant="plain" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </IconButton>
                    <IconButton label={`Mover pergunta ${i + 1} para baixo`} size="sm" variant="plain" disabled={i === questions.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown />
                    </IconButton>
                    <IconButton label={`Remover pergunta ${i + 1}`} size="sm" variant="plain" disabled={questions.length === 1} onClick={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}>
                      <Trash2 />
                    </IconButton>
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                  <Field label={`Texto da pergunta ${i + 1}`}>
                    {(f) => <Input id={f.id} value={q.text} maxLength={300} onChange={(e) => updateQuestion(q.key, { text: e.target.value })} required />}
                  </Field>
                  <Field label="Formato">
                    {(f) => (
                      <Select id={f.id} value={q.type} onChange={(e) => updateQuestion(q.key, { type: e.target.value as Question["type"], required: e.target.value === "text" ? false : q.required })}>
                        {Object.entries(QUESTION_TYPE_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>
                {q.type === "choice" ? (
                  <Field label="Opções" hint="Uma opção por linha (2 a 12)." className="mt-3">
                    {(f) => <Textarea id={f.id} aria-describedby={f.describedBy} value={q.optionsText} rows={4} onChange={(e) => updateQuestion(q.key, { optionsText: e.target.value })} />}
                  </Field>
                ) : null}
                <div className="mt-3">
                  <Checkbox label="Resposta obrigatória" checked={q.required} onCheckedChange={(v) => updateQuestion(q.key, { required: v === true })} />
                </div>
              </li>
            ))}
          </ol>
          <Button type="button" variant="secondary" className="mt-4" onClick={() => setQuestions((qs) => [...qs, blank()])} disabled={questions.length >= 40}>
            <Plus aria-hidden /> Adicionar pergunta
          </Button>
        </section>
      </fieldset>

      {error ? <Alert tone="error" title={error} /> : null}

      <div className="flex flex-wrap gap-3">
        {canDesign ? (
          <Button type="submit" variant={canLaunch ? "secondary" : "primary"} loading={pending}>
            Salvar rascunho
          </Button>
        ) : null}
        {canLaunch ? (
          <Button type="button" onClick={() => setLaunchOpen(true)} disabled={pending}>
            <Rocket aria-hidden /> Lançar pesquisa
          </Button>
        ) : null}
        {survey && canDesign ? (
          <Button type="button" variant="destructive" onClick={remove} disabled={pending} className="sm:ml-auto">
            <Trash2 aria-hidden /> Excluir rascunho
          </Button>
        ) : null}
      </div>

      <Modal
        open={launchOpen}
        onOpenChange={setLaunchOpen}
        title="Lançar pesquisa"
        description="Todas as pessoas ativas da empresa serão convidadas."
        footer={
          <>
            <Button variant="ghost" onClick={() => setLaunchOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={launch} disabled={!closesOn} loading={pending}>
              <Rocket aria-hidden /> Lançar agora
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Recebe respostas até" hint="A pesquisa encerra às 23h59 (horário de Brasília) deste dia.">
            {(f) => <Input id={f.id} aria-describedby={f.describedBy} type="date" min={minDate} value={closesOn} onChange={(e) => setClosesOn(e.target.value)} />}
          </Field>
          <Alert tone="warning" title="Depois do lançamento, nada disso muda">
            Perguntas, k ({k}) e os grupos de segmentação ficam congelados para proteger o anonimato. Os resultados aparecem em lotes de pelo menos {k} respostas.
          </Alert>
        </div>
      </Modal>
    </form>
  );
}
