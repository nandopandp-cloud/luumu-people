"use client";

import { FileText, ImageIcon, Plus, Video, X } from "lucide-react";
import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { Button, IconButton } from "@/design-system/components/button";
import { Input } from "@/design-system/components/field";
import { Spinner } from "@/design-system/components/spinner";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";

export type EditorAttachment =
  | { kind: "file"; title: string; fileId: string; mimeType: string | null; sizeBytes: number | null }
  | { kind: "video"; title: string; videoUrl: string };

export type AttachmentsHandle = { pick: (kind: "image" | "file") => void };

const MAX = 10;
const MAX_BYTES = 4 * 1024 * 1024;
const IMAGES = ["image/png", "image/jpeg", "image/webp"];
const ACCEPTED = ["application/pdf", ...IMAGES];

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
const kindLabel = (mime: string | null) => (mime === "application/pdf" ? "PDF" : mime?.startsWith("image/") ? mime.slice(6).toUpperCase().replace("JPEG", "JPG") : "Arquivo");

/**
 * Anexos do comunicado: arquivos (PDF ou imagem até 4 MB, armazenamento
 * privado) e vídeos do YouTube/Vimeo (só o link). O servidor valida tudo de novo.
 * `handle.pick()` abre o seletor a partir de outro lugar (barra do editor de texto).
 */
export function AttachmentsField({
  value,
  onChange,
  errors,
  handle,
  disabled,
}: {
  value: EditorAttachment[];
  onChange: (next: EditorAttachment[]) => void;
  errors: Record<string, string>;
  handle?: Ref<AttachmentsHandle>;
  disabled?: boolean;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [accept, setAccept] = useState(ACCEPTED);
  const [uploading, setUploading] = useState(false);
  const full = value.length >= MAX;

  function pick(kind: "image" | "file") {
    if (full) return toast({ tone: "error", title: `Use no máximo ${MAX} anexos.` });
    setAccept(kind === "image" ? IMAGES : ACCEPTED);
    requestAnimationFrame(() => input.current?.click());
  }
  useImperativeHandle(handle, () => ({ pick }));

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
      onChange([...value, { kind: "file", title: file.name.slice(0, 120), fileId: data.id as string, mimeType: data.mimeType as string, sizeBytes: data.sizeBytes as number }]);
      toast({ tone: "success", title: "Anexo enviado" });
    } catch (e) {
      toast({ tone: "error", title: "Falha no envio do anexo", description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {value.length ? (
        <ul className="space-y-2" aria-label="Anexos">
          {value.map((a, i) => {
            const Icon = a.kind === "video" ? Video : a.mimeType === "application/pdf" ? FileText : ImageIcon;
            const titleError = errors[`attachments.${i}.title`];
            const urlError = errors[`attachments.${i}.videoUrl`];
            return (
              <li key={i} className={cn("rounded-lg border bg-white p-3", titleError || urlError ? "border-red-500" : "border-line")}>
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <input
                      aria-label={`Nome do anexo ${i + 1}`}
                      value={a.title}
                      maxLength={120}
                      placeholder={a.kind === "video" ? "Nome do vídeo" : "Nome do arquivo"}
                      disabled={disabled}
                      onChange={(e) => update(i, { title: e.target.value })}
                      className="w-full truncate rounded-sm bg-transparent text-body-sm font-semibold text-neutral-900 placeholder:font-normal placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
                    />
                    {a.kind === "file" ? (
                      <p className="mt-0.5 text-caption text-neutral-500">
                        {a.sizeBytes ? `${formatSize(a.sizeBytes)} • ` : ""}
                        {kindLabel(a.mimeType)}
                      </p>
                    ) : (
                      <Input
                        aria-label={`Link do vídeo ${i + 1}`}
                        invalid={Boolean(urlError)}
                        value={a.videoUrl}
                        maxLength={500}
                        disabled={disabled}
                        placeholder="https://www.youtube.com/watch?v=… ou https://vimeo.com/…"
                        onChange={(e) => update(i, { videoUrl: e.target.value })}
                        className="mt-2 h-9"
                      />
                    )}
                    {titleError || urlError ? (
                      <p role="alert" className="mt-1 text-caption font-medium text-red-600">
                        {titleError ?? urlError}
                      </p>
                    ) : null}
                  </div>
                  <IconButton label={`Remover anexo ${a.title || i + 1}`} variant="plain" size="sm" onClick={() => remove(i)} disabled={disabled}>
                    <X />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={() => pick("file")} disabled={disabled || uploading || full}>
          {uploading ? <Spinner className="size-4" /> : <Plus aria-hidden className="text-purple-600" />} {uploading ? "Enviando…" : "Anexar arquivo"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onChange([...value, { kind: "video", title: "", videoUrl: "" }])} disabled={disabled || full}>
          <Plus aria-hidden className="text-purple-600" /> Adicionar vídeo
        </Button>
      </div>
      <p className="text-caption text-neutral-500">
        PDF ou imagem até 4 MB; vídeos do YouTube ou Vimeo.
        <br />
        Até {MAX} anexos.
      </p>
      <input
        ref={input}
        type="file"
        accept={accept.join(",")}
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
  );
}
