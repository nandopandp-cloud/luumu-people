"use client";

import { ImagePlus, Trash2, X } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { Switch } from "@/design-system/components/choice";
import { Alert } from "@/design-system/components/feedback";
import { Field, Input, Textarea } from "@/design-system/components/field";
import { Select } from "@/design-system/components/select";
import { Spinner } from "@/design-system/components/spinner";
import { useToast } from "@/design-system/components/toast";
import type { CoverIllustration, CoverTheme } from "@/design-system/illustrations/cover-art";
import { ILLUSTRATION_LABEL, THEME_LABEL } from "@/features/announcements/labels";
import { BannerView } from "@/features/home/hero-banner";
import { api, ApiError } from "@/lib/api-client";
import { fromLocalInput } from "./format";

export type EditableBanner = {
  id?: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaUrl: string;
  theme: CoverTheme;
  illustration: CoverIllustration | "";
  imageFileId: string | null;
  active: boolean;
  startsAt: string;
  endsAt: string;
};

const MAX_IMAGE = 4 * 1024 * 1024;

/** Editor de banner com prévia ao vivo exatamente como aparece na home. */
export function BannerEditor({ banner }: { banner: EditableBanner }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState(banner);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof EditableBanner>(key: K, value: EditableBanner[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function upload(file: File) {
    if (file.size > MAX_IMAGE) {
      toast({ tone: "error", title: "Imagem muito grande", description: "Envie PNG, JPG ou WEBP até 4 MB." });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/v1/files?purpose=home_banner", { method: "POST", body: form, credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail ?? "Não foi possível enviar a imagem.");
      set("imageFileId", data.id as string);
      setPreview(URL.createObjectURL(file));
    } catch (e) {
      toast({ tone: "error", title: "Falha no envio da imagem", description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
    }
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setErrors({});
    const body = {
      title: values.title,
      subtitle: values.subtitle || null,
      ctaLabel: values.ctaLabel || null,
      ctaUrl: values.ctaUrl || null,
      theme: values.theme,
      illustration: values.illustration || null,
      imageFileId: values.imageFileId,
      active: values.active,
      startsAt: fromLocalInput(values.startsAt),
      endsAt: fromLocalInput(values.endsAt),
    };
    startTransition(async () => {
      try {
        if (banner.id) await api(`/api/v1/banners/${banner.id}`, { method: "PUT", body });
        else await api("/api/v1/banners", { method: "POST", body });
        toast({ tone: "success", title: banner.id ? "Banner atualizado" : "Banner criado", description: values.active ? "Ele já aparece na home (dentro do período definido)." : "Ative-o quando quiser que apareça na home." });
        router.push("/gestao/comunicacao/banners" as Route);
        router.refresh();
      } catch (e) {
        if (e instanceof ApiError) {
          setErrors(Object.fromEntries(e.fieldErrors.map((f) => [f.path, f.message])));
          setError(e.fieldErrors[0]?.message ?? e.message);
        } else setError("Não foi possível salvar. Tente novamente.");
      }
    });
  }

  function remove() {
    if (!banner.id || !window.confirm("Excluir este banner? Ele sai da home imediatamente.")) return;
    startTransition(async () => {
      try {
        await api(`/api/v1/banners/${banner.id}`, { method: "DELETE" });
        toast({ tone: "success", title: "Banner excluído" });
        router.push("/gestao/comunicacao/banners" as Route);
        router.refresh();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Não foi possível excluir.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="previa" className="space-y-2">
        <h2 id="previa" className="text-body-sm font-semibold text-neutral-700">
          Prévia na home
        </h2>
        <div className="min-h-[300px]" inert>
          <BannerView
            greeting="Olá, Ana!"
            imagePreviewUrl={preview}
            banner={{
              id: "preview",
              title: values.title || "Título do banner",
              subtitle: values.subtitle || null,
              ctaLabel: values.ctaLabel || null,
              ctaUrl: values.ctaUrl ? "/previa" : null,
              theme: values.theme,
              illustration: values.illustration || null,
              imageFileId: values.imageFileId,
            }}
          />
        </div>
        <p className="text-caption text-neutral-600">A saudação usa o primeiro nome de cada pessoa.</p>
      </section>

      <form onSubmit={save} className="card space-y-5 p-6" noValidate>
        <fieldset disabled={pending} className="space-y-5">
          <Field label="Título" error={errors.title}>
            {(f) => <Input id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} value={values.title} maxLength={90} onChange={(e) => set("title", e.target.value)} required />}
          </Field>
          <Field label="Texto de apoio" hint="Opcional, até 200 caracteres." error={errors.subtitle}>
            {(f) => <Textarea id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} value={values.subtitle} maxLength={200} rows={2} onChange={(e) => set("subtitle", e.target.value)} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <Field label="Texto do botão" hint="Opcional." error={errors.ctaLabel}>
              {(f) => <Input id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} value={values.ctaLabel} maxLength={30} placeholder="Ex.: Ver trilha" onChange={(e) => set("ctaLabel", e.target.value)} />}
            </Field>
            <Field label="Destino do botão" hint="Página da plataforma (ex.: /trilhas) ou endereço https://." error={errors.ctaUrl}>
              {(f) => <Input id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} value={values.ctaUrl} maxLength={500} placeholder="/meus-cursos" onChange={(e) => set("ctaUrl", e.target.value)} />}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cor de fundo">
              {(f) => (
                <Select id={f.id} value={values.theme} onChange={(e) => set("theme", e.target.value as CoverTheme)}>
                  {Object.entries(THEME_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Ilustração" hint={values.imageFileId ? "A imagem enviada tem prioridade sobre a ilustração." : undefined}>
              {(f) => (
                <Select id={f.id} aria-describedby={f.describedBy} value={values.illustration} onChange={(e) => set("illustration", e.target.value as CoverIllustration | "")}>
                  <option value="">Jornada (padrão da home)</option>
                  {Object.entries(ILLUSTRATION_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-body-sm font-medium text-neutral-700">Imagem (opcional)</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? <Spinner className="size-4" /> : <ImagePlus aria-hidden />} {values.imageFileId ? "Trocar imagem" : "Enviar imagem"}
              </Button>
              {values.imageFileId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    set("imageFileId", null);
                    setPreview(null);
                  }}
                >
                  <X aria-hidden /> Remover imagem
                </Button>
              ) : null}
              <span className="text-caption text-neutral-500">PNG, JPG ou WEBP até 4 MB. Recomendado: 900 × 600 px.</span>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void upload(file);
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Exibir a partir de (horário de Brasília)" hint="Vazio: imediatamente." error={errors.startsAt}>
              {(f) => <Input id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} type="datetime-local" value={values.startsAt} onChange={(e) => set("startsAt", e.target.value)} />}
            </Field>
            <Field label="Exibir até" hint="Vazio: sem data para sair." error={errors.endsAt}>
              {(f) => <Input id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} type="datetime-local" value={values.endsAt} onChange={(e) => set("endsAt", e.target.value)} />}
            </Field>
          </div>

          <Switch label="Banner ativo (aparece na home de todas as pessoas)" checked={values.active} onCheckedChange={(v) => set("active", v === true)} />
        </fieldset>

        {error ? <Alert tone="error" title={error} /> : null}

        <div className="flex flex-wrap gap-3 border-t border-line pt-5">
          <Button type="submit" loading={pending} disabled={uploading}>
            {banner.id ? "Salvar banner" : "Criar banner"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push("/gestao/comunicacao/banners" as Route)}>
            Cancelar
          </Button>
          {banner.id ? (
            <Button type="button" variant="destructive" onClick={remove} disabled={pending} className="sm:ml-auto">
              <Trash2 aria-hidden /> Excluir banner
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
