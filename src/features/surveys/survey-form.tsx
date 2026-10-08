"use client";

import { CircleCheck, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { Alert } from "@/design-system/components/feedback";
import { Textarea } from "@/design-system/components/field";
import { cn } from "@/design-system/cn";
import { api, ApiError } from "@/lib/api-client";
import { ANONYMITY_COPY, SCALE_LABELS } from "./labels";

type Question = { id: string; type: "scale" | "enps" | "choice" | "text"; text: string; options: string[] | null; required: boolean };
type Answers = Record<string, number | string>;

const MAX_COMMENT = 2000;

/**
 * Formulário de pesquisa anônima. Rascunho SOMENTE no sessionStorage deste
 * navegador (nunca no servidor), apagado ao enviar.
 */
export function SurveyForm({ surveyId, questions }: { surveyId: string; questions: Question[] }) {
  const storageKey = `luumu:pesquisa:${surveyId}`;
  const [answers, setAnswers] = useState<Answers>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura o rascunho local uma única vez
      if (saved) setAnswers(JSON.parse(saved) as Answers);
    } catch {
      /* sem armazenamento local: segue sem rascunho */
    }
  }, [storageKey]);

  function set(id: string, value: number | string) {
    setAnswers((current) => {
      const next = { ...current, [id]: value };
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignorado */
      }
      return next;
    });
    setMissing((m) => m.filter((q) => q !== id));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const blank = questions.filter((q) => q.required && (answers[q.id] === undefined || String(answers[q.id]).trim() === "")).map((q) => q.id);
    if (blank.length) {
      setMissing(blank);
      setError(`Faltam ${blank.length} ${blank.length === 1 ? "pergunta obrigatória" : "perguntas obrigatórias"}.`);
      document.getElementById(`q-${blank[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const payload = Object.fromEntries(Object.entries(answers).filter(([, v]) => String(v).trim() !== ""));
    startTransition(async () => {
      try {
        await api(`/api/v1/me/surveys/${surveyId}/responses`, { method: "POST", body: { answers: payload } });
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* ignorado */
        }
        setDone(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Não foi possível enviar. Tente novamente.");
      }
    });
  }

  if (done) {
    return (
      <div className="card flex flex-col items-center px-6 py-12 text-center" role="status">
        <span className="flex size-14 items-center justify-center rounded-full bg-green-100 text-green-700">
          <CircleCheck aria-hidden className="size-8" />
        </span>
        <h2 className="mt-4 text-h2 font-bold text-neutral-900">Obrigado por participar!</h2>
        <p className="mt-2 max-w-md text-body text-neutral-600">Sua resposta foi registrada de forma anônima. Os resultados aparecem só de forma agrupada.</p>
        <Button asChild variant="soft" className="mt-6">
          <Link href="/pesquisas">Voltar para pesquisas</Link>
        </Button>
      </div>
    );
  }

  const answered = questions.filter((q) => answers[q.id] !== undefined && String(answers[q.id]).trim() !== "").length;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Alert tone="info" title="Pesquisa anônima">
        <span className="flex items-start gap-1.5">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          {ANONYMITY_COPY.form}
        </span>
      </Alert>

      <ol className="space-y-4">
        {questions.map((q, i) => (
          <li key={q.id} id={`q-${q.id}`} className={cn("card scroll-mt-24 p-5 sm:p-6", missing.includes(q.id) && "ring-2 ring-red-500")}>
            <QuestionField index={i + 1} question={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} invalid={missing.includes(q.id)} />
          </li>
        ))}
      </ol>

      {error ? <Alert tone="error" title={error} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-neutral-600" aria-live="polite">
          {answered} de {questions.length} respondidas
        </p>
        <Button type="submit" size="lg" loading={pending}>
          Enviar respostas
        </Button>
      </div>
    </form>
  );
}

function QuestionField({ index, question: q, value, onChange, invalid }: { index: number; question: Question; value: number | string | undefined; onChange: (v: number | string) => void; invalid: boolean }) {
  const id = useId();
  const legend = (
    <legend className="mb-4 text-body font-semibold text-neutral-900">
      <span className="mr-1.5 text-purple-600">{index}.</span>
      {q.text}
      {q.required ? <span className="sr-only"> (obrigatória)</span> : <span className="ml-1.5 text-caption font-normal text-neutral-500">(opcional)</span>}
    </legend>
  );

  if (q.type === "text") {
    return (
      <div>
        <label htmlFor={id} className="mb-3 block text-body font-semibold text-neutral-900">
          <span className="mr-1.5 text-purple-600">{index}.</span>
          {q.text}
          {q.required ? null : <span className="ml-1.5 text-caption font-normal text-neutral-500">(opcional)</span>}
        </label>
        <Textarea id={id} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} maxLength={MAX_COMMENT} invalid={invalid} aria-describedby={`${id}-hint`} rows={4} />
        <p id={`${id}-hint`} className="mt-1.5 text-caption text-neutral-500">
          {ANONYMITY_COPY.form} ({String(value ?? "").length}/{MAX_COMMENT})
        </p>
      </div>
    );
  }

  const options =
    q.type === "scale"
      ? SCALE_LABELS.map((label, i) => ({ value: i + 1, label: String(i + 1), description: label }))
      : q.type === "enps"
        ? Array.from({ length: 11 }, (_, i) => ({ value: i, label: String(i), description: i === 0 ? "Nada provável" : i === 10 ? "Muito provável" : String(i) }))
        : (q.options ?? []).map((o) => ({ value: o, label: o, description: o }));

  return (
    <fieldset aria-invalid={invalid || undefined}>
      {legend}
      <div className={cn(q.type === "choice" ? "grid gap-2 sm:grid-cols-2" : "flex flex-wrap gap-2")}>
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={String(o.value)}
              className={cn(
                "relative flex cursor-pointer items-center justify-center rounded-lg border text-body-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-purple-500",
                q.type === "choice" ? "justify-start px-4 py-3" : q.type === "scale" ? "h-auto min-w-[88px] flex-1 flex-col gap-0.5 px-2 py-2.5" : "size-11",
                checked ? "border-purple-500 bg-purple-500 text-white" : "border-line bg-white text-neutral-800 hover:border-purple-300 hover:bg-purple-50",
              )}
            >
              <input type="radio" name={`${id}-${q.id}`} value={String(o.value)} checked={checked} onChange={() => onChange(o.value)} className="sr-only" aria-label={q.type === "choice" ? undefined : o.description} />
              <span>{o.label}</span>
              {q.type === "scale" ? <span className={cn("text-[11px] font-normal", checked ? "text-white/90" : "text-neutral-500")}>{o.description}</span> : null}
            </label>
          );
        })}
      </div>
      {q.type === "enps" ? (
        <p aria-hidden className="mt-2 flex justify-between text-caption text-neutral-500 sm:max-w-[600px]">
          <span>0 · Nada provável</span>
          <span>10 · Muito provável</span>
        </p>
      ) : null}
    </fieldset>
  );
}
