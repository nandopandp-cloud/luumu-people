"use client";

import { Crop, ImagePlus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/design-system/components/button";
import { Spinner } from "@/design-system/components/spinner";
import { useToast } from "@/design-system/components/toast";
import { ImageEditor } from "./image-editor";

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
/** Com o editor, o original pode ser maior: o envio é o recorte, já no tamanho final. */
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

/** Recorte obrigatório antes do envio: proporção e tamanho finais de onde a imagem aparece. */
export type ImageCrop = { title: string; aspect: number; output: { width: number; height: number } };

/**
 * Envio de imagem para o armazenamento privado (/api/v1/files). Valida tipo e
 * tamanho no navegador para dar retorno rápido; a validação definitiva (pelos
 * bytes do arquivo) é do servidor. Devolve o id do arquivo e uma prévia local.
 *
 * Com `crop`, a imagem passa pelo editor (zoom, rotação, espelhamento e corte)
 * antes do envio, e uma imagem já enviada pode ser reajustada.
 */
export function ImageUploadField({
  label,
  purpose,
  value,
  onChange,
  hint = "PNG, JPG ou WEBP até 3 MB.",
  crop,
}: {
  label: string;
  purpose: "home_banner" | "announcement_cover";
  value: string | null;
  onChange: (fileId: string | null, previewUrl: string | null) => void;
  hint?: string;
  crop?: ImageCrop;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [uploading, setUploading] = useState(false);
  /** Imagem aberta no editor; `source` guarda o original escolhido nesta sessão para reajustes sem perda. */
  const [editing, setEditing] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => () => void (source && URL.revokeObjectURL(source)), [source]);

  async function upload(file: Blob, name: string) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file, name);
      const response = await fetch(`/api/v1/files?purpose=${purpose}`, { method: "POST", body: form, credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail ?? "Não foi possível enviar a imagem.");
      onChange(data.id as string, URL.createObjectURL(file));
      toast({ tone: "success", title: "Imagem enviada" });
      return true;
    } catch (e) {
      toast({ tone: "error", title: "Falha no envio da imagem", description: e instanceof Error ? e.message : undefined });
      return false;
    } finally {
      setUploading(false);
    }
  }

  function choose(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast({ tone: "error", title: "Formato não aceito", description: "Envie uma imagem PNG, JPG ou WEBP." });
      return;
    }
    const limit = crop ? MAX_SOURCE_BYTES : MAX_IMAGE_BYTES;
    if (file.size > limit) {
      toast({ tone: "error", title: "Imagem muito grande", description: `Essa imagem tem ${(file.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB. O limite é ${limit / 1024 / 1024} MB.` });
      return;
    }
    if (!crop) return void upload(file, file.name);
    const url = URL.createObjectURL(file);
    setSource(url);
    setEditing(url);
  }

  return (
    <div>
      <p className="mb-1.5 text-body-sm font-medium text-neutral-700">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => input.current?.click()} disabled={uploading} aria-describedby={hintId}>
          {uploading ? <Spinner className="size-4" /> : <ImagePlus aria-hidden />} {uploading ? "Enviando…" : value ? "Trocar imagem" : "Enviar imagem"}
        </Button>
        {value && crop ? (
          <Button type="button" variant="ghost" onClick={() => setEditing(source ?? `/api/v1/files/${value}`)} disabled={uploading}>
            <Crop aria-hidden /> Ajustar imagem
          </Button>
        ) : null}
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
          if (file) choose(file);
        }}
      />
      {crop ? (
        <ImageEditor
          // Nova imagem = editor zerado.
          key={editing ?? "closed"}
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          src={editing}
          title={crop.title}
          description="Arraste para enquadrar e ajuste zoom, rotação e espelhamento. A área clara é exatamente o que aparece na plataforma."
          aspect={crop.aspect}
          shape="rect"
          output={crop.output}
          pending={uploading}
          onSave={async (blob) => {
            if (await upload(blob, "imagem.jpg")) setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}
