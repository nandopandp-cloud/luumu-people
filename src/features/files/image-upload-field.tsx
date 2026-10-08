"use client";

import { ImagePlus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/design-system/components/button";
import { Spinner } from "@/design-system/components/spinner";
import { useToast } from "@/design-system/components/toast";

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

/**
 * Envio de imagem para o armazenamento privado (/api/v1/files). Valida tipo e
 * tamanho no navegador para dar retorno rápido; a validação definitiva (pelos
 * bytes do arquivo) é do servidor. Devolve o id do arquivo e uma prévia local.
 */
export function ImageUploadField({
  label,
  purpose,
  value,
  onChange,
  hint = "PNG, JPG ou WEBP até 3 MB.",
}: {
  label: string;
  purpose: "home_banner" | "announcement_cover";
  value: string | null;
  onChange: (fileId: string | null, previewUrl: string | null) => void;
  hint?: string;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast({ tone: "error", title: "Formato não aceito", description: "Envie uma imagem PNG, JPG ou WEBP." });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast({ tone: "error", title: "Imagem muito grande", description: `Essa imagem tem ${(file.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB. O limite é 3 MB.` });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/v1/files?purpose=${purpose}`, { method: "POST", body: form, credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail ?? "Não foi possível enviar a imagem.");
      onChange(data.id as string, URL.createObjectURL(file));
      toast({ tone: "success", title: "Imagem enviada" });
    } catch (e) {
      toast({ tone: "error", title: "Falha no envio da imagem", description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-body-sm font-medium text-neutral-700">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => input.current?.click()} disabled={uploading} aria-describedby={hintId}>
          {uploading ? <Spinner className="size-4" /> : <ImagePlus aria-hidden />} {uploading ? "Enviando…" : value ? "Trocar imagem" : "Enviar imagem"}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" onClick={() => onChange(null, null)} disabled={uploading}>
            <X aria-hidden /> Remover imagem
          </Button>
        ) : null}
        <span id={hintId} className="text-caption text-neutral-600">
          {hint}
        </span>
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
    </div>
  );
}
