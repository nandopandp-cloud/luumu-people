"use client";

import { Archive, CalendarClock, Pin, Send, Trash2 } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Switch } from "@/design-system/components/choice";
import { Modal } from "@/design-system/components/dialog";
import { Alert } from "@/design-system/components/feedback";
import { Field, Input, Textarea } from "@/design-system/components/field";
import { Select } from "@/design-system/components/select";
import { useToast } from "@/design-system/components/toast";
import { CoverArt, type CoverIllustration, type CoverTheme } from "@/design-system/illustrations/cover-art";
import { ImageUploadField } from "@/features/files/image-upload-field";
import { ANNOUNCEMENT_CATEGORY } from "@/features/home/labels";
import { api, ApiError } from "@/lib/api-client";
import { ILLUSTRATION_LABEL, MANAGED_STATUS, THEME_LABEL } from "./labels";

type Values = {
  title: string;
  summary: string;
  body: string;
  category: string;
  theme: CoverTheme;
  illustration: CoverIllustration;
  pinned: boolean;
  coverFileId: string | null;
};

export type EditorAnnouncement = Values & { id: string; managedStatus: "draft" | "scheduled" | "published" | "archived" };

const EMPTY: Values = { title: "", summary: "", body: "", category: "institucional", theme: "purple", illustration: "megaphone", pinned: false, coverFileId: null };

/** Data/hora local (input datetime-local) → ISO com fuso. */
const toIso = (local: string) => new Date(local).toISOString();

/**
 * Editor de comunicado. A interface só oferece o que a pessoa pode fazer; o
 * servidor decide (rascunho × publicação, janela de agendamento).
 */
export function AnnouncementEditor({ announcement, canPublish }: { announcement?: EditorAnnouncement; canPublish: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<Values>(announcement ? { ...announcement, body: announcement.body ?? "" } : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const status = announcement?.managedStatus ?? "draft";
  const locked = status !== "draft" && !canPublish;

  const update = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));

  function run(action: () => Promise<void>, success: string) {
    setError(null);
    setErrors({});
    startTransition(async () => {
      try {
        await action();
        toast({ tone: "success", title: success });
      } catch (e) {
        if (e instanceof ApiError) {
          setErrors(Object.fromEntries(e.fieldErrors.map((f) => [f.path, f.message])));
          setError(e.message);
        } else setError("Não foi possível concluir. Tente novamente.");
      }
    });
  }

  /** Salva (cria ou atualiza) e devolve o id. */
  async function save(): Promise<string> {
    const body = { ...values, body: values.body.trim() || null };
    if (announcement) {
      await api(`/api/v1/announcements/${announcement.id}`, { method: "PUT", body });
      return announcement.id;
    }
    const { id } = await api<{ id: string }>("/api/v1/announcements", { method: "POST", body });
    return id;
  }

  const saveDraft = () =>
    run(async () => {
      const id = await save();
      if (!announcement) router.push(`/gestao/comunicacao/${id}` as Route);
      router.refresh();
    }, announcement ? "Alterações salvas" : "Rascunho criado");

  const publish = (publishAt?: string) =>
    run(async () => {
      const id = await save();
      await api(`/api/v1/announcements/${id}/publish`, { method: "POST", body: publishAt ? { publishAt: toIso(publishAt) } : {} });
      setScheduleOpen(false);
      router.push("/gestao/comunicacao" as Route);
      router.refresh();
    }, publishAt ? "Comunicado agendado" : "Comunicado publicado");

  const archive = () => {
    if (!announcement || !window.confirm("Arquivar este comunicado? Ele sai do mural, mas continua no histórico.")) return;
    run(async () => {
      await api(`/api/v1/announcements/${announcement.id}/archive`, { method: "POST" });
      router.refresh();
    }, "Comunicado arquivado");
  };

  const remove = () => {
    if (!announcement || !window.confirm("Excluir este rascunho? Esta ação não pode ser desfeita.")) return;
    run(async () => {
      await api(`/api/v1/announcements/${announcement.id}`, { method: "DELETE" });
      router.push("/gestao/comunicacao" as Route);
      router.refresh();
    }, "Rascunho excluído");
  };

  const category = ANNOUNCEMENT_CATEGORY[values.category];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form
        className="card space-y-5 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          saveDraft();
        }}
      >
        {locked ? <Alert tone="warning" title="Somente quem publica pode editar um comunicado que já está no ar ou agendado." /> : null}
        <fieldset disabled={locked || pending} className="space-y-5">
          <Field label="Título" error={errors.title}>
            {(f) => <Input id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} value={values.title} maxLength={120} onChange={(e) => update("title", e.target.value)} required />}
          </Field>
          <Field label="Resumo" hint="Aparece nos cards do mural e do Início (até 240 caracteres)." error={errors.summary}>
            {(f) => <Input id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} value={values.summary} maxLength={240} onChange={(e) => update("summary", e.target.value)} required />}
          </Field>
          <Field label="Texto completo" hint="Texto simples. Deixe uma linha em branco entre os parágrafos." error={errors.body}>
            {(f) => <Textarea id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} value={values.body} rows={10} maxLength={10_000} onChange={(e) => update("body", e.target.value)} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Categoria">
              {(f) => (
                <Select id={f.id} value={values.category} onChange={(e) => update("category", e.target.value)}>
                  {Object.entries(ANNOUNCEMENT_CATEGORY).map(([value, c]) => (
                    <option key={value} value={value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Cor da capa">
              {(f) => (
                <Select id={f.id} value={values.theme} onChange={(e) => update("theme", e.target.value as CoverTheme)}>
                  {Object.entries(THEME_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Ilustração">
              {(f) => (
                <Select id={f.id} value={values.illustration} onChange={(e) => update("illustration", e.target.value as CoverIllustration)}>
                  {Object.entries(ILLUSTRATION_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <ImageUploadField
            label="Imagem de capa (opcional)"
            purpose="announcement_cover"
            value={values.coverFileId}
            hint="PNG, JPG ou WEBP. Depois de escolher, você ajusta zoom, rotação, espelhamento e corte. Sem imagem, usamos a cor e a ilustração escolhidas."
            crop={{ title: "Ajustar capa do comunicado", aspect: 16 / 9, output: { width: 1600, height: 900 } }}
            onChange={(fileId, previewUrl) => {
              update("coverFileId", fileId);
              setCoverPreview(previewUrl);
            }}
          />
          <div>
            <Switch label="Fixar no topo do mural" checked={values.pinned} onCheckedChange={(v) => update("pinned", v === true)} disabled={!canPublish} />
            {!canPublish ? <p className="mt-1 text-caption text-neutral-500">Fixar exige permissão de publicação.</p> : null}
          </div>
        </fieldset>

        {error ? <Alert tone="error" title={error} /> : null}

        <div className="flex flex-wrap gap-3 border-t border-line pt-5">
          {!locked ? (
            <Button type="submit" variant={status === "draft" && canPublish ? "secondary" : "primary"} loading={pending}>
              {status === "draft" ? "Salvar rascunho" : "Salvar alterações"}
            </Button>
          ) : null}
          {canPublish && (status === "draft" || status === "scheduled" || status === "archived") ? (
            <>
              <Button type="button" onClick={() => publish()} disabled={pending}>
                <Send aria-hidden /> Publicar agora
              </Button>
              <Button type="button" variant="ghost" onClick={() => setScheduleOpen(true)} disabled={pending}>
                <CalendarClock aria-hidden /> Agendar
              </Button>
            </>
          ) : null}
          {canPublish && (status === "published" || status === "scheduled") ? (
            <Button type="button" variant="ghost" onClick={archive} disabled={pending}>
              <Archive aria-hidden /> Arquivar
            </Button>
          ) : null}
          {announcement && status === "draft" ? (
            <Button type="button" variant="destructive" onClick={remove} disabled={pending} className="sm:ml-auto">
              <Trash2 aria-hidden /> Excluir rascunho
            </Button>
          ) : null}
        </div>
      </form>

      <aside aria-label="Prévia no mural" className="space-y-3">
        <p className="text-body-sm font-semibold text-neutral-700">Prévia no mural</p>
        <article className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          {coverPreview || values.coverFileId ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local ou arquivo privado servido pela própria API
            <img src={coverPreview ?? `/api/v1/files/${values.coverFileId}`} alt="" className="h-[110px] w-full object-cover" />
          ) : (
            <CoverArt theme={values.theme} illustration={values.illustration} className="h-[110px]" />
          )}
          <div className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              {category ? <Badge tone={category.tone}>{category.label}</Badge> : null}
              {values.pinned ? (
                <Badge tone="yellow">
                  <Pin aria-hidden /> Fixado
                </Badge>
              ) : null}
              <Badge tone={MANAGED_STATUS[status]!.tone} className="ml-auto">
                {MANAGED_STATUS[status]!.label}
              </Badge>
            </div>
            <p className="mt-3 text-[15px] font-semibold leading-snug text-neutral-900">{values.title || "Título do comunicado"}</p>
            <p className="mt-1 line-clamp-2 text-body-sm text-neutral-600">{values.summary || "Resumo que aparece no card."}</p>
          </div>
        </article>
      </aside>

      <Modal
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        title="Agendar publicação"
        description="O comunicado entra no mural automaticamente na data escolhida."
        footer={
          <>
            <Button variant="ghost" onClick={() => setScheduleOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => publish(scheduleAt)} disabled={!scheduleAt} loading={pending}>
              Agendar
            </Button>
          </>
        }
      >
        <Field label="Data e hora de publicação">
          {(f) => <Input id={f.id} type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />}
        </Field>
      </Modal>
    </div>
  );
}
