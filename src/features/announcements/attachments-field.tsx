"use client";

import { FileText, ImageIcon, Paperclip, Plus, Video, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button, IconButton } from "@/design-system/components/button";
import { Input } from "@/design-system/components/field";
import { Spinner } from "@/design-system/components/spinner";
import { useToast } from "@/design-system/components/toast";

export type EditorAttachment =
  | { kind: "file"; title: string; fileId: string; mimeType: string | null }
  | { kind: "video"; title: string; videoUrl: string };

const MAX = 10;
const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPTED = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

/**
 * Anexos do comunicado: arquivos (PDF ou imagem até 4 MB, armazenamento
 * privado) e vídeos do YouTube/Vimeo (só o link). O servidor valida tudo de novo.
 */
export function AttachmentsField({ value, onChange, errors }: { value: EditorAttachment[]; onChange: (next: EditorAttachment[]) => void; errors: Record<string, string> }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const full = value.length >= MAX;

  const update = (index: number, patch: Partial<EditorAttachment>) => onChange(value.map((a, i) => (i === index ? ({ ...a, ...patch } as EditorAttachment) : a)));
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  async function upload(file: File) {
    if (!ACCEPTED.includes(file.type)) return toast({ tone: "error", title: "Formato não aceito", description: "Anexe um PDF ou uma imagem PNG, JPG ou WEBP." });
    if (file.size > MAX_BYTES) return toast({ tone: "error", title: "Arquivo muito grande", description: "O limite é 4 MB por arquivo." });
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/v1/files?purpose=announcement_attachment", { method: "POST", body: form, credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail ?? "Não foi possível enviar o arquivo.");
      onChange([...value, { kind: "file", title: file.name.replace(/\.[^.]+$/, "").slice(0, 120), fileId: data.id as string, mimeType: data.mimeType as string }]);
    } catch (e) {
      toast({ tone: "error", title: "Falha no envio do anexo", description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
    }
  }

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1.5 text-body-sm font-medium text-neutral-700">Anexos (opcional)</legend>
      {value.length ? (
        <ul className="space-y-2">
          {value.map((a, i) => {
            const Icon = a.kind === "video" ? Video : a.mimeType === "application/pdf" ? FileText : ImageIcon;
            const titleError = errors[`attachments.${i}.title`];
            const urlError = errors[`attachments.${i}.videoUrl`];
            return (
              <li key={i} className="rounded-lg border border-line p-3">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-purple-100 text-purple-600">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <div className="grid min-w-0 flex-1 gap-2">
                    <Input aria-label={`Nome do anexo ${i + 1}`} invalid={Boolean(titleError)} value={a.title} maxLength={120} onChange={(e) => update(i, { title: e.target.value })} placeholder="Nome exibido" />
                    {titleError ? <p role="alert" className="text-caption font-medium text-red-600">{titleError}</p> : null}
                    {a.kind === "video" ? (
                      <>
                        <Input
                          aria-label={`Link do vídeo ${i + 1}`}
                          invalid={Boolean(urlError)}
                          value={a.videoUrl}
                          maxLength={500}
                          placeholder="https://www.youtube.com/watch?v=… ou https://vimeo.com/…"
                          onChange={(e) => update(i, { videoUrl: e.target.value })}
                        />
                        {urlError ? <p role="alert" className="text-caption font-medium text-red-600">{urlError}</p> : null}
                      </>
                    ) : null}
                  </div>
                  <IconButton label={`Remover anexo ${a.title || i + 1}`} variant="plain" size="sm" onClick={() => remove(i)}>
                    <X />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={uploading || full}>
          {uploading ? <Spinner className="size-4" /> : <Paperclip aria-hidden />} {uploading ? "Enviando…" : "Anexar arquivo"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...value, { kind: "video", title: "", videoUrl: "" }])} disabled={full}>
          <Plus aria-hidden /> Adicionar vídeo
        </Button>
        <span className="text-caption text-neutral-600">PDF ou imagem até 4 MB; vídeos do YouTube ou Vimeo. Até {MAX} anexos.</span>
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
    </fieldset>
  );
}
