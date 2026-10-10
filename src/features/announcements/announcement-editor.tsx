"use client";

import {
  AlertCircle,
  Archive,
  CalendarClock,
  CalendarDays,
  Check,
  Eye,
  FileText,
  Heart,
  ImageIcon,
  ImagePlus,
  Lightbulb,
  Megaphone,
  MessageCircle,
  Paperclip,
  Pencil,
  Pin,
  Send,
  Settings,
  SquarePen,
  Trash2,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Switch } from "@/design-system/components/choice";
import { Modal } from "@/design-system/components/dialog";
import { Field, Input, Textarea } from "@/design-system/components/field";
import { Select } from "@/design-system/components/select";
import { Spinner } from "@/design-system/components/spinner";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { COVER_ICONS, CoverArt, type CoverIllustration, type CoverTheme } from "@/design-system/illustrations/cover-art";
import { useImageUploader } from "@/features/files/image-upload-field";
import { ANNOUNCEMENT_CATEGORY } from "@/features/home/labels";
import { api, ApiError } from "@/lib/api-client";
import { AttachmentsField, type AttachmentsHandle, type EditorAttachment } from "./attachments-field";
import { ILLUSTRATION_LABEL, MANAGED_STATUS, THEME_LABEL } from "./labels";
import { RichTextEditor } from "./rich-text-editor";

type Values = {
  title: string;
  summary: string;
  body: string;
  category: string;
  theme: CoverTheme;
  illustration: CoverIllustration;
  pinned: boolean;
  coverFileId: string | null;
  /** "" = empresa toda. */
  audienceOrgUnitId: string;
  attachments: EditorAttachment[];
};

/** Área disponível como público, já com a profundidade na hierarquia (para recuo na lista). */
export type AudienceOption = { id: string; name: string; depth: number };

export type EditorAnnouncement = Values & {
  id: string;
  managedStatus: "draft" | "scheduled" | "published" | "archived";
  publishedAt: string | null;
  likes: number;
  comments: number;
};

const EMPTY: Values = { title: "", summary: "", body: "", category: "institucional", theme: "purple", illustration: "megaphone", pinned: false, coverFileId: null, audienceOrgUnitId: "", attachments: [] };
const LIMITS = { title: 120, summary: 240, body: 10_000 } as const;
const LIST = "/gestao/comunicacao" as Route;

const THEME_DOT: Record<CoverTheme, string> = {
  purple: "bg-purple-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  blue: "bg-blue-500",
  pink: "bg-pink-500",
  yellow: "bg-yellow-500",
};

/** Data/hora local (input datetime-local) → ISO com fuso. */
const toIso = (local: string) => new Date(local).toISOString();

const TZ = "America/Sao_Paulo";
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
function previewDate(iso: string | null, status: EditorAnnouncement["managedStatus"]) {
  if (!iso || status === "draft") return "Ainda não publicado";
  const d = new Date(iso);
  const text = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(d).replace(/\./g, "");
  if (status === "scheduled") return `Agendado para ${text}`;
  return dayKey(d) === dayKey(new Date()) ? `Hoje, ${text}` : text;
}

/** Card de seção da referência: ícone, título, descrição e ação opcional. */
function Section({ icon: Icon, title, optional, description, action, children, className }: { icon: LucideIcon; title: string; optional?: boolean; description: string; action?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("card p-5 sm:p-6", className)}>
      <SectionHeader id={id} icon={Icon} title={title} optional={optional} description={description} action={action} />
      {children}
    </section>
  );
}

function SectionHeader({ id, icon: Icon, title, optional, description, action }: { id?: string; icon: LucideIcon; title: string; optional?: boolean; description: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start gap-3">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-h4 font-bold text-neutral-900">
          {title}
          {optional ? <span className="text-body-sm font-normal text-neutral-600"> (opcional)</span> : null}
        </h2>
        <p className="mt-0.5 text-caption text-neutral-600">{description}</p>
      </div>
      {action}
    </header>
  );
}

/** Rótulo com obrigatório (*) e contador de caracteres à direita. */
function CountedLabel({ htmlFor, label, required, count, max }: { htmlFor: string; label: string; required?: boolean; count: number; max: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-body-sm font-semibold text-neutral-800">
        {label}
        {required ? (
          <span aria-hidden className="text-red-600">
            {" "}
            *
          </span>
        ) : null}
      </label>
      <span aria-hidden className="text-caption tabular-nums text-neutral-500">
        {count.toLocaleString("pt-BR")}/{max.toLocaleString("pt-BR")}
      </span>
    </div>
  );
}

function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <p id={id} role="alert" className="flex items-center gap-1 text-caption font-medium text-red-600">
        <AlertCircle aria-hidden className="size-3.5" />
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={id} className="text-caption text-neutral-500">
      {hint}
    </p>
  ) : null;
}

const TIPS = [
  "Comece pelo mais importante: o que muda, para quem e a partir de quando.",
  "Prefira frases curtas e parágrafos de até 3 linhas.",
  "Use títulos e listas para organizar orientações e passo a passo.",
  "Termine com o próximo passo: um link, um prazo ou com quem falar.",
  "Coloque documentos de apoio como anexos, em vez de colar textos longos.",
];

/**
 * Editor de comunicado (criar/editar). A interface só oferece o que a pessoa
 * pode fazer; o servidor decide (rascunho × publicação, janela de agendamento).
 */
export function AnnouncementEditor({ announcement, canPublish, audienceOptions }: { announcement?: EditorAnnouncement; canPublish: boolean; audienceOptions: AudienceOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const ids = { title: useId(), summary: useId(), body: useId() };
  const attachmentsRef = useRef<AttachmentsHandle>(null);
  const [values, setValues] = useState<Values>(announcement ? { ...announcement, body: announcement.body ?? "" } : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const status = announcement?.managedStatus ?? "draft";
  const locked = status !== "draft" && !canPublish;
  const disabled = locked || pending;

  const update = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));
  const cover = useImageUploader({
    purpose: "announcement_cover",
    value: values.coverFileId,
    crop: { title: "Ajustar capa do comunicado", aspect: 16 / 9, output: { width: 1600, height: 900 } },
    onChange: (fileId, previewUrl) => {
      update("coverFileId", fileId);
      setCoverPreview(previewUrl);
    },
  });
  const coverSrc = coverPreview ?? (values.coverFileId ? `/api/v1/files/${values.coverFileId}` : null);

  function run(action: () => Promise<void>, success: string) {
    setError(null);
    setErrors({});
    startTransition(async () => {
      try {
        await action();
        toast({ tone: "success", title: success });
      } catch (e) {
        if (e instanceof ApiError && e.fieldErrors.length) {
          const mapped = Object.fromEntries(e.fieldErrors.map((f) => [f.path, f.message]));
          setErrors(mapped);
          // Erro sem campo na tela: mostra a mensagem em vez de pedir para procurar um destaque inexistente.
          const shown = /^(title|summary|body|audienceOrgUnitId|attachments\.\d+\.(title|videoUrl))$/;
          const orphan = e.fieldErrors.find((f) => !shown.test(f.path));
          setError(orphan ? { title: "Não foi possível salvar.", detail: orphan.message } : { title: "Alguns dados de envio são inválidos.", detail: "Verifique os campos em destaque para continuar." });
        } else setError({ title: e instanceof ApiError ? e.message : "Não foi possível concluir. Tente novamente." });
      }
    });
  }

  /** Salva (cria ou atualiza) e devolve o id. */
  async function save(): Promise<string> {
    // Só os campos do formulário: a API recusa chaves extras (id, status, contadores…).
    const body = {
      title: values.title,
      summary: values.summary,
      category: values.category,
      theme: values.theme,
      illustration: values.illustration,
      pinned: values.pinned,
      coverFileId: values.coverFileId,
      body: values.body.trim() || null,
      audienceOrgUnitId: values.audienceOrgUnitId || null,
      attachments: values.attachments.map((a) => (a.kind === "file" ? { kind: a.kind, title: a.title, fileId: a.fileId } : { kind: a.kind, title: a.title, videoUrl: a.videoUrl })),
    };
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
      router.push(LIST);
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
      router.push(LIST);
      router.refresh();
    }, "Rascunho excluído");
  };

  const category = ANNOUNCEMENT_CATEGORY[values.category];
  const statusBadge = MANAGED_STATUS[status]!;
  const IllustrationIcon = COVER_ICONS[values.illustration];

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        saveDraft();
      }}
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
    >
      <div className="min-w-0 space-y-6">
        {locked ? (
          <div role="status" className="flex items-start gap-2 rounded-lg border border-yellow-100 bg-yellow-100/60 px-4 py-3 text-body-sm text-neutral-800">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-yellow-700" />
            Somente quem publica pode editar um comunicado que já está no ar ou agendado.
          </div>
        ) : null}

        <Section icon={FileText} title="Informações do comunicado" description="Preencha as informações principais do seu comunicado.">
          <fieldset disabled={disabled} className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <CountedLabel htmlFor={ids.title} label="Título" required count={values.title.length} max={LIMITS.title} />
              <Input id={ids.title} aria-required aria-describedby={errors.title ? `${ids.title}-msg` : undefined} invalid={Boolean(errors.title)} value={values.title} maxLength={LIMITS.title} onChange={(e) => update("title", e.target.value)} />
              <FieldMessage id={`${ids.title}-msg`} error={errors.title} />
            </div>
            <div className="flex flex-col gap-1.5">
              <CountedLabel htmlFor={ids.summary} label="Resumo" required count={values.summary.length} max={LIMITS.summary} />
              <Textarea id={ids.summary} aria-required aria-describedby={`${ids.summary}-msg`} invalid={Boolean(errors.summary)} value={values.summary} maxLength={LIMITS.summary} rows={2} onChange={(e) => update("summary", e.target.value)} />
              <FieldMessage id={`${ids.summary}-msg`} error={errors.summary} hint="Este resumo será exibido no mural e na listagem de comunicados." />
            </div>
          </fieldset>
        </Section>

        <Section
          icon={SquarePen}
          title="Conteúdo"
          description="Escreva o conteúdo completo do seu comunicado."
          action={
            <button
              type="button"
              onClick={() => setTipsOpen(true)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-purple-50 px-3 text-caption font-semibold text-purple-600 hover:bg-purple-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
            >
              <Lightbulb aria-hidden className="size-4" /> Dicas de conteúdo
            </button>
          }
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.body} className="sr-only">
              Texto completo
            </label>
            <RichTextEditor
              id={ids.body}
              describedBy={`${ids.body}-msg`}
              invalid={Boolean(errors.body)}
              value={values.body}
              maxLength={LIMITS.body}
              disabled={disabled}
              onChange={(v) => update("body", v)}
              onAttach={(kind) => attachmentsRef.current?.pick(kind)}
            />
            <div className="flex items-start justify-between gap-3">
              <FieldMessage id={`${ids.body}-msg`} error={errors.body} hint="Use a barra para formatar. Deixe uma linha em branco entre os parágrafos." />
              <span aria-hidden className="shrink-0 text-caption tabular-nums text-neutral-500">
                {values.body.length.toLocaleString("pt-BR")}/{LIMITS.body.toLocaleString("pt-BR")}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <SectionHeader icon={ImageIcon} title="Imagem de capa" optional description="Adicione uma imagem para destacar seu comunicado." />
            {coverSrc ? (
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                <div className="relative overflow-hidden rounded-lg bg-neutral-100">
                  {/* eslint-disable-next-line @next/next/no-img-element -- prévia local ou arquivo privado servido pela própria API */}
                  <img src={coverSrc} alt="Capa atual do comunicado" className="aspect-video w-full object-cover" />
                  <div className="absolute right-3 top-3 flex gap-2">
                    {cover.adjust ? (
                      <button type="button" onClick={cover.adjust} disabled={disabled} aria-label="Ajustar imagem de capa" title="Ajustar imagem" className="flex size-9 items-center justify-center rounded-full bg-white text-neutral-800 shadow-md hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 disabled:opacity-50">
                        <Pencil aria-hidden className="size-4" />
                      </button>
                    ) : null}
                    <button type="button" onClick={cover.remove} disabled={disabled} aria-label="Remover imagem de capa" title="Remover imagem" className="flex size-9 items-center justify-center rounded-full bg-white text-red-600 shadow-md hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 disabled:opacity-50">
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                </div>
                <CoverDropzone label="Trocar imagem" uploading={cover.uploading} disabled={disabled} dragging={dragging} setDragging={setDragging} onPick={cover.pick} onDrop={cover.choose} />
              </div>
            ) : (
              <CoverDropzone label="Enviar imagem" uploading={cover.uploading} disabled={disabled} dragging={dragging} setDragging={setDragging} onPick={cover.pick} onDrop={cover.choose} wide />
            )}
            {coverSrc ? (
              <button type="button" onClick={cover.remove} disabled={disabled} className="mt-2 inline-flex items-center gap-1.5 rounded-sm text-caption font-medium text-red-600 hover:underline focus-visible:outline-2 focus-visible:outline-purple-500 disabled:opacity-50">
                <Trash2 aria-hidden className="size-3.5" /> Remover imagem
              </button>
            ) : null}
            {cover.elements}
          </div>
        </Section>

        <Section icon={Settings} title="Configurações" description="Defina as informações de categorização, público e aparência.">
          <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-3">
            <Field label={<span className="font-semibold text-neutral-800">Categoria <span aria-hidden className="text-red-600">*</span></span>}>
              {(f) => (
                <Select id={f.id} aria-required leading={<Megaphone />} value={values.category} onChange={(e) => update("category", e.target.value)}>
                  {Object.entries(ANNOUNCEMENT_CATEGORY).map(([value, c]) => (
                    <option key={value} value={value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={<span className="font-semibold text-neutral-800">Cor da capa</span>}>
              {(f) => (
                <Select id={f.id} leading={<span className={cn("size-5 rounded-full", THEME_DOT[values.theme])} />} value={values.theme} onChange={(e) => update("theme", e.target.value as CoverTheme)}>
                  {Object.entries(THEME_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label={<span className="font-semibold text-neutral-800">Ilustração</span>}
              hint={values.coverFileId ? "Indisponível: a capa usa a imagem enviada." : undefined}
            >
              {(f) => (
                <Select id={f.id} aria-describedby={f.describedBy} leading={<IllustrationIcon />} value={values.illustration} disabled={Boolean(values.coverFileId)} onChange={(e) => update("illustration", e.target.value as CoverIllustration)}>
                  {Object.entries(ILLUSTRATION_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </fieldset>
        </Section>
      </div>

      <div className="space-y-6">
        <Section icon={Eye} title="Prévia do comunicado" description="Veja como seu comunicado aparecerá no mural.">
          <article className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
            {coverSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- prévia local ou arquivo privado servido pela própria API
              <img src={coverSrc} alt="" className="aspect-[2/1] w-full object-cover" />
            ) : (
              <CoverArt theme={values.theme} illustration={values.illustration} className="aspect-[2/1]" iconClassName="size-14" />
            )}
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                {category ? <Badge tone={category.tone}>{category.label}</Badge> : null}
                {values.pinned ? (
                  <Badge tone="yellow">
                    <Pin aria-hidden /> Fixado
                  </Badge>
                ) : null}
                <Badge tone={statusBadge.tone} className="ml-auto">
                  {statusBadge.label}
                </Badge>
              </div>
              <p className="mt-3 text-h4 font-bold leading-snug text-neutral-900">{values.title || "Título do comunicado"}</p>
              <p className="mt-1 line-clamp-2 text-body-sm text-neutral-600">{values.summary || "Resumo que aparece no card."}</p>
              <div className="mt-4 flex items-center gap-4 border-t border-line pt-3 text-caption text-neutral-600">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays aria-hidden className="size-4" /> {previewDate(announcement?.publishedAt ?? null, status)}
                </span>
                <span className="ml-auto inline-flex items-center gap-1" aria-label={`${announcement?.likes ?? 0} curtidas`}>
                  <Heart aria-hidden className="size-4" /> {announcement?.likes ?? 0}
                </span>
                <span className="inline-flex items-center gap-1" aria-label={`${announcement?.comments ?? 0} comentários`}>
                  <MessageCircle aria-hidden className="size-4" /> {announcement?.comments ?? 0}
                </span>
              </div>
            </div>
          </article>
        </Section>

        <Section icon={UsersRound} title="Público" description="Quem poderá ver este comunicado?">
          <Field label={<span className="sr-only">Público</span>} hint="Com uma área escolhida, o comunicado aparece só para quem está nela ou nas subáreas." error={errors.audienceOrgUnitId}>
            {(f) => (
              <Select id={f.id} aria-describedby={f.describedBy} value={values.audienceOrgUnitId} disabled={disabled} onChange={(e) => update("audienceOrgUnitId", e.target.value)}>
                <option value="">Toda a empresa</option>
                {audienceOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {" ".repeat(o.depth)}
                    {o.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </Section>

        <Section icon={Paperclip} title="Anexos" optional description="Adicione documentos, vídeos ou links complementares.">
          <AttachmentsField handle={attachmentsRef} value={values.attachments} onChange={(next) => update("attachments", next)} errors={errors} disabled={disabled} />
          <div className="mt-5 border-t border-line pt-5">
            <div className="flex items-start gap-3">
              <Switch
                label={
                  <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-800">
                    <Pin aria-hidden className="size-4 text-purple-600" /> Fixar no topo do mural
                  </span>
                }
                checked={values.pinned}
                onCheckedChange={(v) => update("pinned", v === true)}
                disabled={!canPublish || disabled}
                aria-describedby="fixar-descricao"
              />
            </div>
            <p id="fixar-descricao" className="mt-1 pl-[52px] text-caption text-neutral-600">
              {canPublish ? "Deixa o comunicado em destaque no mural da empresa." : "Fixar exige permissão de publicação."}
            </p>
          </div>
          {error ? (
            <div role="alert" className="mt-5 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
                <AlertCircle className="size-4" />
              </span>
              <div>
                <p className="text-body-sm font-semibold text-red-600">{error.title}</p>
                {error.detail ? <p className="text-caption text-red-600">{error.detail}</p> : null}
              </div>
            </div>
          ) : null}
        </Section>

        <div className="flex flex-wrap justify-end gap-3">
          {announcement && status === "draft" ? (
            <Button type="button" variant="ghost" onClick={remove} disabled={pending} className="mr-auto text-red-600">
              <Trash2 aria-hidden /> Excluir rascunho
            </Button>
          ) : null}
          {canPublish && (status === "published" || status === "scheduled") ? (
            <Button type="button" variant="ghost" onClick={archive} disabled={pending}>
              <Archive aria-hidden /> Arquivar
            </Button>
          ) : null}
          {canPublish && status !== "published" ? (
            <Button type="button" variant="ghost" onClick={() => setScheduleOpen(true)} disabled={pending}>
              <CalendarClock aria-hidden /> Agendar
            </Button>
          ) : null}
          {!locked ? (
            <Button type="submit" variant={status === "draft" && canPublish ? "secondary" : "primary"} loading={pending}>
              <Check aria-hidden /> {status === "draft" ? "Salvar rascunho" : "Salvar alterações"}
            </Button>
          ) : null}
          {canPublish && status !== "published" ? (
            <Button type="button" onClick={() => publish()} disabled={pending}>
              <Send aria-hidden /> Publicar agora
            </Button>
          ) : null}
        </div>
      </div>

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

      <Modal open={tipsOpen} onOpenChange={setTipsOpen} title="Dicas de conteúdo" description="Comunicados claros são lidos até o fim." footer={<Button onClick={() => setTipsOpen(false)}>Entendi</Button>}>
        <ul className="space-y-3">
          {TIPS.map((tip) => (
            <li key={tip} className="flex gap-2 text-body-sm text-neutral-800">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-green-700" />
              {tip}
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-md bg-neutral-50 px-3 py-2 text-caption text-neutral-600">
          Formatação: **negrito**, *itálico*, __sublinhado__, “- ” para listas, “## ” para títulos e [texto](https://…) para links.
        </p>
      </Modal>
    </form>
  );
}

function CoverDropzone({
  label,
  uploading,
  disabled,
  dragging,
  setDragging,
  onPick,
  onDrop,
  wide,
}: {
  label: string;
  uploading: boolean;
  disabled: boolean;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onPick: () => void;
  onDrop: (file: File) => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled || uploading}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onDrop(file);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 disabled:opacity-60",
        wide ? "min-h-[180px] w-full" : "min-h-full",
        dragging ? "border-purple-500 bg-purple-50" : "border-neutral-300 bg-neutral-50 hover:border-purple-300 hover:bg-purple-50/60",
      )}
    >
      {uploading ? <Spinner className="size-6 text-purple-600" /> : wide ? <ImagePlus aria-hidden className="size-7 text-purple-600" /> : <ImageIcon aria-hidden className="size-7 text-purple-600" />}
      <span className="mt-1 text-body-sm font-semibold text-purple-600">{uploading ? "Enviando…" : label}</span>
      <span className="text-caption text-neutral-500">PNG, JPG ou WEBP</span>
      <span className="text-caption text-neutral-500">Máx. 20 MB · você ajusta o enquadramento</span>
    </button>
  );
}
