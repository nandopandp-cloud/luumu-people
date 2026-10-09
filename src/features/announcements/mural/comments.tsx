"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Button, IconButton } from "@/design-system/components/button";
import { Field, Textarea } from "@/design-system/components/field";
import { useToast } from "@/design-system/components/toast";
import { api, ApiError } from "@/lib/api-client";

export type CommentItem = { id: string; body: string; createdAt: string; author: { name: string; image: string | null }; canDelete: boolean };

const when = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

/** Comentários do comunicado: lista, novo comentário e remoção (autor ou moderação). */
export function Comments({ announcementId, initial }: { announcementId: string; initial: CommentItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!body.trim()) return setError("Escreva um comentário.");
    startTransition(async () => {
      try {
        await api(`/api/v1/announcements/${announcementId}/comments`, { method: "POST", body: { body } });
        setBody("");
        toast({ tone: "success", title: "Comentário publicado" });
        router.refresh();
      } catch (e) {
        setError(e instanceof ApiError ? (e.fieldErrors[0]?.message ?? e.message) : "Não foi possível comentar. Tente novamente.");
      }
    });
  }

  function remove(id: string) {
    if (!window.confirm("Remover este comentário?")) return;
    startTransition(async () => {
      try {
        await api(`/api/v1/announcements/${announcementId}/comments/${id}`, { method: "DELETE" });
        toast({ tone: "success", title: "Comentário removido" });
        router.refresh();
      } catch (e) {
        toast({ tone: "error", title: "Não foi possível remover", description: e instanceof ApiError ? e.message : undefined });
      }
    });
  }

  return (
    <section aria-labelledby="comentarios-titulo" id="comentarios" className="scroll-mt-24">
      <h2 id="comentarios-titulo" className="text-h3 font-bold text-neutral-900">
        Comentários ({initial.length})
      </h2>
      {initial.length === 0 ? (
        <p className="mt-2 text-body-sm text-neutral-600">Ninguém comentou ainda. Que tal começar a conversa?</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {initial.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.author.name} src={c.author.image} size="sm" />
              <div className="min-w-0 flex-1 rounded-lg bg-neutral-50 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span className="text-body-sm font-semibold text-neutral-900">{c.author.name}</span>
                  <time className="text-caption text-neutral-500" dateTime={c.createdAt}>
                    {when(c.createdAt)}
                  </time>
                  {c.canDelete ? (
                    <IconButton label={`Remover comentário de ${c.author.name}`} variant="plain" size="sm" className="ml-auto" onClick={() => remove(c.id)} disabled={pending}>
                      <Trash2 />
                    </IconButton>
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-line break-words text-body-sm text-neutral-800">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
        <Field label="Escreva um comentário" hint="Seja gentil: comentários são visíveis para todas as pessoas que veem este comunicado." error={error ?? undefined}>
          {(f) => <Textarea id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} value={body} maxLength={1000} rows={3} onChange={(e) => setBody(e.target.value)} disabled={pending} />}
        </Field>
        <Button type="submit" loading={pending}>
          Comentar
        </Button>
      </form>
    </section>
  );
}
