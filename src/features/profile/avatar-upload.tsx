"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { Spinner } from "@/design-system/components/spinner";
import { useToast } from "@/design-system/components/toast";

/** Botão de câmera sobre a foto do perfil: envia a nova foto (PNG, JPG ou WEBP até 2 MB). */
export function AvatarUploadButton() {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ tone: "error", title: "Imagem muito grande", description: "Envie PNG, JPG ou WEBP até 2 MB." });
      return;
    }
    startTransition(async () => {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/v1/me/avatar", { method: "POST", body: form, credentials: "same-origin" }).catch(() => null);
      if (!response?.ok) {
        const data = await response?.json().catch(() => null);
        toast({ tone: "error", title: "Não foi possível trocar a foto", description: data?.detail ?? "Tente novamente em instantes." });
        return;
      }
      toast({ tone: "success", title: "Foto atualizada!" });
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={pending}
        aria-label="Trocar foto do perfil"
        className="absolute bottom-1 right-1 flex size-10 items-center justify-center rounded-full bg-purple-500 text-white shadow-md ring-4 ring-white transition-colors hover:bg-purple-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 disabled:opacity-70"
      >
        {pending ? <Spinner className="size-4" /> : <Camera aria-hidden className="size-[18px]" />}
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={onChange} />
    </>
  );
}
