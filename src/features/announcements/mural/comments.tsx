"use client";

import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Button } from "@/design-system/components/button";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { api, ApiError } from "@/lib/api-client";
import { encodeMentions, type MentionPart } from "@/lib/mentions";
import { MentionTextarea } from "./mention-textarea";

export type CommentItem = {
  id: string;
  parentId: string | null;
  parts: MentionPart[];
  createdAt: string;
  author: { id: string; name: string; image: string | null };
  likes: number;
  likedByMe: boolean;
  canDelete: boolean;
};

const when = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

/** Âncora atual (#comentario-…): destaca o comentário para onde a notificação levou. */
const subscribeHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};
const useHash = () => useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");

/** Texto do comentário com as menções destacadas (nomes atuais, vindos do servidor). */
function Body({ parts }: { parts: MentionPart[] }) {
  return (
    <p className="mt-1 whitespace-pre-line break-words text-body-sm text-neutral-800">
      {parts.map((p, i) =>
        p.type === "text" ? (
          <span key={i}>{p.value}</span>
        ) : (
          <span key={i} className="rounded-sm bg-purple-50 px-0.5 font-semibold text-purple-700">
            @{p.name}
          </span>
        ),
      )}
    </p>
  );
}

/** Formulário de comentário (ou resposta) com menções. */
function CommentForm({
  announcementId,
  parentId,
  initial,
  onDone,
  onCancel,
  compact,
}: {
  announcementId: string;
  parentId?: string;
  initial?: { text: string; mentions: Map<string, string> };
  onDone: () => void;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const id = useId();
  const toast = useToast();
  const [text, setText] = useState(initial?.text ?? "");
  const [mentions, setMentions] = useState(initial?.mentions ?? new Map<string, string>());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!text.trim()) return setError("Escreva um comentário.");
    startTransition(async () => {
      try {
        await api(`/api/v1/announcements/${announcementId}/comments`, { method: "POST", body: { body: encodeMentions(text, mentions), parentId: parentId ?? null } });
        setText("");
        setMentions(new Map());
        toast({ tone: "success", title: parentId ? "Resposta publicada" : "Comentário publicado" });
        onDone();
      } catch (e) {
        setError(e instanceof ApiError ? (e.fieldErrors[0]?.message ?? e.message) : "Não foi possível comentar. Tente novamente.");
      }
    });
  }

  return (
    <form onSubmit={submit} className={cn("space-y-2", compact ? "mt-3" : "mt-5")} noValidate>
      <label htmlFor={id} className={cn("text-body-sm font-medium text-neutral-700", compact && "sr-only")}>
        {parentId ? "Escreva uma resposta" : "Escreva um comentário"}
      </label>
      <MentionTextarea
        id={id}
        announcementId={announcementId}
        value={text}
        onChange={setText}
        mentions={mentions}
        onMentionsChange={setMentions}
        describedBy={`${id}-hint`}
        invalid={Boolean(error)}
        disabled={pending}
        rows={compact ? 2 : 3}
        autoFocus={compact}
        placeholder={parentId ? "Escreva uma resposta…" : "Compartilhe sua opinião. Use @ para mencionar alguém."}
      />
      {error ? (
        <p id={`${id}-hint`} role="alert" className="text-caption font-medium text-red-600">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-caption text-neutral-500">
          {compact ? "Use @ para mencionar alguém." : "Seja gentil: comentários são visíveis para todas as pessoas que veem este comunicado."}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size={compact ? "sm" : "md"} loading={pending}>
          {parentId ? "Responder" : "Comentar"}
        </Button>
        {onCancel ? (
          <Button type="button" size={compact ? "sm" : "md"} variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** Comentários do comunicado: respostas (um nível), curtidas, menções e remoção. */
export function Comments({ announcementId, initial }: { announcementId: string; initial: CommentItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [replyTo, setReplyTo] = useState<{ rootId: string; mention?: { name: string; id: string } } | null>(null);
  const [likes, setLikes] = useState<Record<string, { likes: number; likedByMe: boolean }>>({});
  const [pending, startTransition] = useTransition();
  const hash = useHash();

  const roots = initial.filter((c) => !c.parentId);
  const repliesOf = (id: string) => initial.filter((c) => c.parentId === id);
  const total = initial.length;

  function remove(c: CommentItem) {
    if (!window.confirm("Remover este comentário?")) return;
    startTransition(async () => {
      try {
        await api(`/api/v1/announcements/${announcementId}/comments/${c.id}`, { method: "DELETE" });
        toast({ tone: "success", title: "Comentário removido" });
        router.refresh();
      } catch (e) {
        toast({ tone: "error", title: "Não foi possível remover", description: e instanceof ApiError ? e.message : undefined });
      }
    });
  }

  function toggleLike(c: CommentItem) {
    const current = likes[c.id] ?? { likes: c.likes, likedByMe: c.likedByMe };
    setLikes((l) => ({ ...l, [c.id]: { likes: current.likes + (current.likedByMe ? -1 : 1), likedByMe: !current.likedByMe } }));
    startTransition(async () => {
      try {
        const next = await api<{ likes: number; likedByMe: boolean }>(`/api/v1/announcements/${announcementId}/comments/${c.id}/like`, { method: current.likedByMe ? "DELETE" : "POST" });
        setLikes((l) => ({ ...l, [c.id]: next }));
      } catch {
        setLikes((l) => ({ ...l, [c.id]: current }));
        toast({ tone: "error", title: "Não foi possível registrar a curtida." });
      }
    });
  }

  const renderComment = (c: CommentItem, rootId: string) => {
    const like = likes[c.id] ?? { likes: c.likes, likedByMe: c.likedByMe };
    return (
      <article
        id={`comentario-${c.id}`}
        aria-label={`Comentário de ${c.author.name}`}
        aria-current={hash === `#comentario-${c.id}` ? "true" : undefined}
        className={cn("flex scroll-mt-28 gap-3 rounded-lg transition-shadow", hash === `#comentario-${c.id}` && "bg-purple-50 p-2 ring-2 ring-purple-300")}
      >
        <Avatar name={c.author.name} src={c.author.image} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="rounded-lg bg-neutral-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-2">
              <span className="text-body-sm font-semibold text-neutral-900">{c.author.name}</span>
              <time className="text-caption text-neutral-500" dateTime={c.createdAt}>
                {when(c.createdAt)}
              </time>
            </div>
            <Body parts={c.parts} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1 pl-1">
            <button
              type="button"
              onClick={() => toggleLike(c)}
              aria-pressed={like.likedByMe}
              aria-label={`${like.likedByMe ? "Descurtir" : "Curtir"} comentário de ${c.author.name} (${like.likes} ${like.likes === 1 ? "curtida" : "curtidas"})`}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-caption font-semibold transition-colors hover:bg-pink-100 focus-visible:outline-2 focus-visible:outline-purple-500",
                like.likedByMe ? "text-pink-700" : "text-neutral-600",
              )}
            >
              <Heart aria-hidden className={cn("size-4", like.likedByMe && "fill-current")} /> {like.likes > 0 ? like.likes : "Curtir"}
            </button>
            <button
              type="button"
              onClick={() => setReplyTo(c.parentId ? { rootId, mention: { name: c.author.name, id: c.author.id } } : { rootId })}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-caption font-semibold text-neutral-600 hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500"
            >
              <MessageCircle aria-hidden className="size-4" /> Responder
              <span className="sr-only"> a {c.author.name}</span>
            </button>
            {c.canDelete ? (
              <button
                type="button"
                onClick={() => remove(c)}
                disabled={pending}
                className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-caption font-semibold text-neutral-600 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-purple-500"
              >
                <Trash2 aria-hidden className="size-4" /> Remover
                <span className="sr-only"> comentário de {c.author.name}</span>
              </button>
            ) : null}
          </div>
        </div>
      </article>
    );
  };

  return (
    <section aria-labelledby="comentarios-titulo" id="comentarios" className="scroll-mt-24">
      <h2 id="comentarios-titulo" className="text-h3 font-bold text-neutral-900">
        Comentários ({total})
      </h2>
      {roots.length === 0 ? (
        <p className="mt-2 text-body-sm text-neutral-600">Ninguém comentou ainda. Que tal começar a conversa?</p>
      ) : (
        <ul className="mt-4 space-y-5">
          {roots.map((root) => {
            const replies = repliesOf(root.id);
            return (
              <li key={root.id}>
                {renderComment(root, root.id)}
                {replies.length || replyTo?.rootId === root.id ? (
                  <div className="ml-11 mt-3 space-y-3 border-l-2 border-purple-100 pl-4">
                    {replies.length ? (
                      <ul className="space-y-3" aria-label={`Respostas a ${root.author.name}`}>
                        {replies.map((r) => (
                          <li key={r.id}>
                            {renderComment(r, root.id)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {replyTo?.rootId === root.id ? (
                      <CommentForm
                        key={`${root.id}:${replyTo.mention?.id ?? ""}`}
                        compact
                        announcementId={announcementId}
                        parentId={root.id}
                        initial={replyTo.mention ? { text: `@${replyTo.mention.name} `, mentions: new Map([[replyTo.mention.name, replyTo.mention.id]]) } : undefined}
                        onDone={() => {
                          setReplyTo(null);
                          router.refresh();
                        }}
                        onCancel={() => setReplyTo(null)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <CommentForm announcementId={announcementId} onDone={() => router.refresh()} />
    </section>
  );
}
