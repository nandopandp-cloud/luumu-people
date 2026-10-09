"use client";

import { Trash2 } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { Switch } from "@/design-system/components/choice";
import { Alert } from "@/design-system/components/feedback";
import { Field, Input, Textarea } from "@/design-system/components/field";
import { Select } from "@/design-system/components/select";
import { useToast } from "@/design-system/components/toast";
import { EVENT_KIND, EVENT_MODE } from "@/features/announcements/mural/labels";
import { fromLocalInput } from "@/features/banners/format";
import { api, ApiError } from "@/lib/api-client";

export type EditableEvent = {
  id?: string;
  title: string;
  description: string;
  kind: string;
  mode: string;
  location: string;
  url: string;
  startsAt: string;
  endsAt: string;
  published: boolean;
};

const LIST = "/gestao/comunicacao/eventos" as Route;

/** Editor de evento da agenda (gestão). */
export function EventEditor({ event }: { event: EditableEvent }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState(event);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof EditableEvent>(key: K, value: EditableEvent[K]) => setValues((v) => ({ ...v, [key]: value }));

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrors({});
    if (!values.startsAt) {
      setErrors({ startsAt: "Informe o início do evento." });
      return;
    }
    const body = {
      title: values.title,
      description: values.description || null,
      kind: values.kind,
      mode: values.mode,
      location: values.location || null,
      url: values.url || null,
      startsAt: fromLocalInput(values.startsAt),
      endsAt: fromLocalInput(values.endsAt),
      published: values.published,
    };
    startTransition(async () => {
      try {
        if (event.id) await api(`/api/v1/events/${event.id}`, { method: "PUT", body });
        else await api("/api/v1/events", { method: "POST", body });
        toast({ tone: "success", title: event.id ? "Evento atualizado" : "Evento criado", description: values.published ? "Ele já aparece na agenda do mural." : "Publique quando quiser que apareça na agenda." });
        router.push(LIST);
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          setErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.path, f.message])));
          setError(err.fieldErrors[0]?.message ?? err.message);
        } else setError("Não foi possível salvar. Tente novamente.");
      }
    });
  }

  function remove() {
    if (!event.id || !window.confirm("Excluir este evento? Ele sai da agenda imediatamente.")) return;
    startTransition(async () => {
      try {
        await api(`/api/v1/events/${event.id}`, { method: "DELETE" });
        toast({ tone: "success", title: "Evento excluído" });
        router.push(LIST);
        router.refresh();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Não foi possível excluir.");
      }
    });
  }

  return (
    <form onSubmit={save} className="card max-w-3xl space-y-5 p-6" noValidate>
      <fieldset disabled={pending} className="space-y-5">
        <Field label="Título" error={errors.title}>
          {(f) => <Input id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} value={values.title} maxLength={120} onChange={(e) => set("title", e.target.value)} required />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            {(f) => (
              <Select id={f.id} value={values.kind} onChange={(e) => set("kind", e.target.value)}>
                {Object.entries(EVENT_KIND).map(([value, k]) => (
                  <option key={value} value={value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Formato">
            {(f) => (
              <Select id={f.id} value={values.mode} onChange={(e) => set("mode", e.target.value)}>
                {Object.entries(EVENT_MODE).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Início (horário de Brasília)" error={errors.startsAt}>
            {(f) => <Input id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} type="datetime-local" value={values.startsAt} onChange={(e) => set("startsAt", e.target.value)} required />}
          </Field>
          <Field label="Fim (opcional)" error={errors.endsAt}>
            {(f) => <Input id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} type="datetime-local" value={values.endsAt} onChange={(e) => set("endsAt", e.target.value)} />}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={values.mode === "online" ? "Local (opcional)" : "Local"} hint="Ex.: Sede, Auditório." error={errors.location}>
            {(f) => <Input id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} value={values.location} maxLength={120} onChange={(e) => set("location", e.target.value)} />}
          </Field>
          <Field label="Link de acesso ou inscrição (opcional)" hint="Endereço https://." error={errors.url}>
            {(f) => <Input id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} value={values.url} maxLength={500} placeholder="https://" onChange={(e) => set("url", e.target.value)} />}
          </Field>
        </div>
        <Field label="Descrição (opcional)" hint="Texto simples. Deixe uma linha em branco entre os parágrafos." error={errors.description}>
          {(f) => <Textarea id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} value={values.description} maxLength={2000} rows={5} onChange={(e) => set("description", e.target.value)} />}
        </Field>
        <Switch label="Publicado (aparece na agenda do mural)" checked={values.published} onCheckedChange={(v) => set("published", v === true)} />
      </fieldset>

      {error ? <Alert tone="error" title={error} /> : null}

      <div className="flex flex-wrap gap-3 border-t border-line pt-5">
        <Button type="submit" loading={pending}>
          {event.id ? "Salvar evento" : "Criar evento"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push(LIST)}>
          Cancelar
        </Button>
        {event.id ? (
          <Button type="button" variant="destructive" onClick={remove} disabled={pending} className="sm:ml-auto">
            <Trash2 aria-hidden /> Excluir evento
          </Button>
        ) : null}
      </div>
    </form>
  );
}
