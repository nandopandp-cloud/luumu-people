"use client";

import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/design-system/components/menu";
import { useToast } from "@/design-system/components/toast";
import { ImageEditor } from "@/features/files/image-editor";

const ACCEPT = "image/png,image/jpeg,image/webp";
/** Limite da imagem ORIGINAL escolhida (o arquivo enviado é o recorte, bem menor). */
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

const KINDS = {
  avatar: { endpoint: "/api/v1/me/avatar", title: "Ajustar foto do perfil", aspect: 1, shape: "round", output: { width: 512, height: 512 }, success: "Foto atualizada!" },
  cover: { endpoint: "/api/v1/me/cover", title: "Ajustar capa do perfil", aspect: 5, shape: "rect", output: { width: 2000, height: 400 }, success: "Capa atualizada!" },
} as const;

/** Escolher arquivo → editar (recorte, zoom, rotação) → enviar. */
function useImageUpload(kind: keyof typeof KINDS) {
  const config = KINDS[kind];
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => (src ? URL.revokeObjectURL(src) : undefined), [src]);

  function pick() {
    input.current?.click();
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) {
      toast({ tone: "error", title: "Formato não suportado", description: "Escolha uma imagem PNG, JPG ou WEBP." });
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast({ tone: "error", title: "Imagem muito grande", description: "Escolha uma imagem de até 15 MB." });
      return;
    }
    setError(null);
    setSrc(URL.createObjectURL(file));
  }

  function upload(blob: Blob) {
    startTransition(async () => {
      const form = new FormData();
      form.set("file", new File([blob], `${kind}.jpg`, { type: "image/jpeg" }));
      const response = await fetch(config.endpoint, { method: "POST", body: form, credentials: "same-origin" }).catch(() => null);
      if (!response?.ok) {
        const data = await response?.json().catch(() => null);
        setError(data?.detail ?? "Não foi possível enviar a imagem. Tente novamente em instantes.");
        return;
      }
      setSrc(null);
      toast({ tone: "success", title: config.success });
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const response = await fetch(config.endpoint, { method: "DELETE", credentials: "same-origin" }).catch(() => null);
      if (!response?.ok) {
        toast({ tone: "error", title: "Não foi possível remover a imagem." });
        return;
      }
      toast({ tone: "success", title: "Capa padrão restaurada." });
      router.refresh();
    });
  }

  const elements = (
    <>
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />
      <ImageEditor
        open={src !== null}
        onOpenChange={(open) => {
          if (!open) setSrc(null);
        }}
        src={src}
        title={config.title}
        aspect={config.aspect}
        shape={config.shape}
        output={config.output}
        pending={pending}
        error={error}
        onSave={upload}
      />
    </>
  );
  return { pick, remove, pending, elements };
}

/** Botão de câmera sobre a foto do perfil. */
export function AvatarUploadButton() {
  const { pick, pending, elements } = useImageUpload("avatar");
  return (
    <>
      <button
        type="button"
        onClick={pick}
        disabled={pending}
        aria-label="Trocar foto do perfil"
        className="absolute bottom-1 right-1 flex size-10 items-center justify-center rounded-full bg-purple-500 text-white shadow-md ring-4 ring-white transition-colors hover:bg-purple-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 disabled:opacity-70"
      >
        <Camera aria-hidden className="size-[18px]" />
      </button>
      {elements}
    </>
  );
}

/** Botão "Alterar capa" no canto da capa do perfil. */
export function CoverUploadButton({ hasCover }: { hasCover: boolean }) {
  const { pick, remove, pending, elements } = useImageUpload("cover");
  return (
    <>
      {hasCover ? (
        <Menu>
          <MenuTrigger asChild>
            <Button variant="secondary" size="sm" loading={pending} className="bg-white/90 backdrop-blur">
              <ImagePlus aria-hidden /> Alterar capa
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={pick}>
              <ImagePlus aria-hidden /> Escolher nova imagem
            </MenuItem>
            <MenuItem onSelect={remove}>
              <Trash2 aria-hidden /> Voltar à capa padrão
            </MenuItem>
          </MenuContent>
        </Menu>
      ) : (
        <Button variant="secondary" size="sm" loading={pending} onClick={pick} className="bg-white/90 backdrop-blur">
          <ImagePlus aria-hidden /> Alterar capa
        </Button>
      )}
      {elements}
    </>
  );
}
