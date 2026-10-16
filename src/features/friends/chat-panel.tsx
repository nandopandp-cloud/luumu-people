"use client";

import { ArrowLeft, Check, CheckCheck, FileText, Heart, Image as ImageIcon, Info, LogOut, Maximize2, Minus, MoreHorizontal, MoreVertical, Paperclip, Pencil, PictureInPicture2, Plus, SendHorizontal, Trash2, UserMinus, UserPlus, UserRound, UsersRound, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Button, IconButton } from "@/design-system/components/button";
import { Modal } from "@/design-system/components/dialog";
import { EmojiPicker, insertAtCaret } from "@/design-system/components/emoji-picker";
import { Lightbox, type LightboxItem } from "@/design-system/components/lightbox";
import { Tooltip } from "@/design-system/components/tooltip";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/design-system/components/menu";
import { Spinner } from "@/design-system/components/spinner";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { errorMessage, fileSize, friendsApi } from "./client";
import { dayLabel, MoodMark, PresenceAvatar, sameDay, timeOf } from "./person-bits";
import type { ChatFile, ChatMessage, ConversationDetail, MessagesPage } from "./types";

/** Atualização periódica da conversa em foco; janelas flutuantes em segundo plano usam `pollMs` maior. */
const POLL_MS = 3_000;
/**
 * Conversa parada fica menos "viva": quanto mais tempo sem mensagem nova, envio ou digitação,
 * mais espaçadas as consultas (cada uma é uma chamada ao servidor). Qualquer atividade, ou
 * voltar para a janela, retoma o ritmo normal na hora.
 */
const IDLE_BACKOFF: { afterMs: number; pollMs: number }[] = [
  { afterMs: 10 * 60_000, pollMs: 30_000 },
  { afterMs: 2 * 60_000, pollMs: 10_000 },
  { afterMs: 30_000, pollMs: 6_000 },
];
const pollDelay = (base: number, idleMs: number) => Math.max(base, IDLE_BACKOFF.find((step) => idleMs >= step.afterMs)?.pollMs ?? base);
const TYPING_EVERY_MS = 3_000;
const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

type Props = {
  detail: ConversationDetail;
  meId: string;
  initial?: MessagesPage | null;
  /** "page": coluna central de /conversas. "dock": janela flutuante, compacta, disponível em toda a plataforma. */
  variant?: "page" | "dock";
  onRead: (id: string) => void;
  onActivity: () => void;
  // Página
  panelOpen?: boolean;
  onTogglePanel?: () => void;
  onBack?: () => void;
  onAddMembers?: () => void;
  onRename?: () => void;
  onLeave?: () => void;
  onUnfriend?: (userId: string) => void;
  onRequestFriend?: (userId: string) => void;
  /** Leva a conversa para uma janela flutuante (e libera a página). */
  onPopOut?: () => void;
  // Janela flutuante
  onMinimize?: () => void;
  onClose?: () => void;
  /** Intervalo da atualização periódica (padrão: 3 s). */
  pollMs?: number;
};

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

const LINK = /(https:\/\/[^\s<>"']+)/g;

/** Texto da mensagem com quebras de linha e links https clicáveis. */
function MessageText({ text, mine }: { text: string; mine: boolean }) {
  const parts = text.split(LINK);
  return (
    <p className="whitespace-pre-wrap break-words text-body-sm leading-relaxed">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part.replace(/[.,;:!?)]+$/, "")} target="_blank" rel="noopener noreferrer" className={cn("underline underline-offset-2", mine ? "text-white" : "text-purple-700")}>
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}

/** Anexo na bolha: abre no lightbox (imagem ampliada ou cartão do documento, com Baixar). */
function Attachment({ file, mine, onOpen }: { file: ChatFile; mine: boolean; onOpen: () => void }) {
  if (file.mimeType.startsWith("image/")) {
    return (
      <button type="button" onClick={onOpen} aria-label={`Abrir imagem ${file.name}`} className="mb-1.5 block overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500">
        {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API */}
        <img src={file.url} alt="" className="max-h-60 w-full max-w-64 cursor-zoom-in object-cover transition-transform hover:scale-[1.02]" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("mb-1.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500", mine ? "bg-white/15 hover:bg-white/25" : "bg-white hover:bg-purple-50")}
    >
      <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", mine ? "bg-white/20 text-white" : "bg-orange-100 text-orange-700")}>
        <FileText className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-body-sm font-semibold">{file.name}</span>
        <span className={cn("block text-caption", mine ? "text-white/80" : "text-neutral-600")}>{fileSize(file.sizeBytes)} · Visualizar</span>
      </span>
    </button>
  );
}

export function ChatPanel(props: Props) {
  const { detail, meId, initial, onRead, onActivity, variant = "page", pollMs = POLL_MS } = props;
  const dock = variant === "dock";
  const titleId = useId();
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>(initial?.items ?? []);
  const [hasMore, setHasMore] = useState(initial?.hasMore ?? false);
  const [othersReadAt, setOthersReadAt] = useState<string | null>(initial?.othersReadAt ?? null);
  const [typing, setTyping] = useState<string[]>(initial?.typing ?? []);
  const [online, setOnline] = useState<string[]>(initial?.online ?? detail.members.filter((m) => m.online).map((m) => m.id));
  const [loading, setLoading] = useState(!initial);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [toDelete, setToDelete] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const since = useRef<string | null>(initial?.serverTime ?? null);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const id = detail.id;

  const markRead = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    friendsApi
      .read(id)
      .then(() => onRead(id))
      .catch(() => undefined);
  }, [id, onRead]);

  // Primeira página (quando a página não trouxe as mensagens já carregadas).
  useEffect(() => {
    if (initial) {
      markRead();
      return;
    }
    let alive = true;
    friendsApi
      .messages(id)
      .then((page) => {
        if (!alive) return;
        setMessages(page.items);
        setHasMore(page.hasMore);
        setOthersReadAt(page.othersReadAt);
        setTyping(page.typing);
        setOnline(page.online);
        since.current = page.serverTime;
        setLoading(false);
        markRead();
      })
      .catch((error) => {
        if (alive) {
          setLoading(false);
          toast({ tone: "error", title: "Não foi possível abrir a conversa.", description: errorMessage(error) });
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial por conversa
  }, [id]);

  // Último movimento da conversa (mensagem nova ou enviada, alguém digitando): define o ritmo da consulta.
  const lastActivity = useRef(0);
  const lastMessageId = messages[messages.length - 1]?.id;
  const someoneTyping = typing.length > 0;
  useEffect(() => {
    lastActivity.current = Date.now();
  }, [lastMessageId, someoneTyping, id]);
  // (o efeito acima roda ao montar, então o ref nunca é lido com o valor inicial 0)

  // Atualização periódica: mensagens novas (e apagadas), leitura, digitação e presença.
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const tick = async () => {
      if (document.visibilityState !== "visible" || !since.current) return;
      try {
        const page = await friendsApi.messages(id, { after: since.current });
        if (!alive) return;
        since.current = page.serverTime;
        setOthersReadAt(page.othersReadAt);
        setTyping(page.typing);
        setOnline(page.online);
        setMessages((current) => {
          const known = new Set(current.map((m) => m.id));
          const fresh = page.items.some((m) => !known.has(m.id) && !m.mine);
          if (fresh) {
            onActivity();
            markRead();
          }
          return mergeMessages(current, page.items);
        });
      } catch {
        /* silencioso: tenta de novo no próximo ciclo */
      }
    };
    const schedule = () => {
      timer = window.setTimeout(async () => {
        await tick();
        if (alive) schedule();
      }, pollDelay(pollMs, Date.now() - lastActivity.current));
    };
    // Volta para a janela: consulta já e retoma o ritmo normal.
    const wake = () => {
      if (document.visibilityState !== "visible") return;
      lastActivity.current = Date.now();
      window.clearTimeout(timer);
      void tick().then(() => alive && schedule());
      markRead();
    };
    schedule();
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [id, markRead, onActivity, pollMs]);

  // Rola até o fim ao abrir e quando chegam mensagens (se a pessoa já estava no fim).
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, typing.length, loading]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  async function loadOlder() {
    const first = messages[0];
    const el = scroller.current;
    if (!first || !el) return;
    setLoadingOlder(true);
    const previousHeight = el.scrollHeight;
    try {
      const page = await friendsApi.messages(id, { before: first.at });
      stickToBottom.current = false;
      setMessages((current) => mergeMessages(current, page.items));
      setHasMore(page.hasMore);
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - previousHeight;
      });
    } catch (error) {
      toast({ tone: "error", title: "Não foi possível carregar as mensagens anteriores.", description: errorMessage(error) });
    } finally {
      setLoadingOlder(false);
    }
  }

  /** Curtir/descurtir: muda na hora e confirma com o servidor. */
  async function toggleLike(m: ChatMessage) {
    const liked = !m.likedByMe;
    setMessages((current) => current.map((x) => (x.id === m.id ? { ...x, likedByMe: liked, likes: Math.max(0, x.likes + (liked ? 1 : -1)) } : x)));
    try {
      const updated = await friendsApi.likeMessage(id, m.id, liked);
      setMessages((current) => mergeMessages(current, [updated]));
    } catch (error) {
      setMessages((current) => current.map((x) => (x.id === m.id ? m : x)));
      toast({ tone: "error", title: "Não foi possível curtir a mensagem.", description: errorMessage(error) });
    }
  }

  // Todos os anexos carregados da conversa, para navegar no lightbox.
  const attachments = messages.filter((m) => m.file && !m.deleted);
  const lightboxItems: LightboxItem[] = attachments.map((m) => ({
    id: m.file!.id,
    name: m.file!.name,
    mimeType: m.file!.mimeType,
    url: m.file!.url,
    downloadUrl: `${m.file!.url}?download=1`,
    caption: `${fileSize(m.file!.sizeBytes)} · ${m.mine ? "Você" : m.senderName} · ${dayLabel(m.at).replace(/^./, (c) => c.toLowerCase())} às ${timeOf(m.at)}`,
  }));
  const openFile = (m: ChatMessage) => setViewing(attachments.findIndex((a) => a.id === m.id));

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await friendsApi.deleteMessage(id, toDelete.id);
      setMessages((current) => current.map((m) => (m.id === toDelete.id ? { ...m, deleted: true, body: "", file: null } : m)));
      onActivity();
    } catch (error) {
      toast({ tone: "error", title: "Não foi possível apagar a mensagem.", description: errorMessage(error) });
    } finally {
      setToDelete(null);
    }
  }

  const other = detail.kind === "direct" ? detail.members.find((m) => m.id === detail.otherId) : null;
  const otherOnline = other ? online.includes(other.id) : false;
  const readAt = othersReadAt ? new Date(othersReadAt).getTime() : 0;

  return (
    <section aria-labelledby={titleId} className={cn("flex h-full min-h-0 flex-col overflow-hidden", dock ? "bg-white" : "card p-0")}>
      {dock ? (
        <DockHeader {...props} titleId={titleId} other={other ?? null} otherOnline={otherOnline} typing={typing} />
      ) : (
        <ChatHeader {...props} titleId={titleId} other={other ?? null} otherOnline={otherOnline} typing={typing} />
      )}

      <div
        ref={scroller}
        onScroll={onScroll}
        className={cn("relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain", dock ? "px-3 py-4" : "px-4 py-5 sm:px-6")}
        aria-live="polite"
        aria-relevant="additions"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-6 text-purple-500" />
            <span className="sr-only">Carregando mensagens</span>
          </div>
        ) : (
          <>
            {hasMore ? (
              <div className="mb-4 text-center">
                <Button variant="ghost" size="sm" onClick={loadOlder} loading={loadingOlder}>
                  Carregar mensagens anteriores
                </Button>
              </div>
            ) : null}
            {messages.length === 0 ? <EmptyConversation detail={detail} /> : null}
            <ol className="space-y-3">
              {messages.map((m, i) => {
                const previous = messages[i - 1];
                const newDay = !previous || !sameDay(previous.at, m.at);
                const runStart = newDay || previous!.senderId !== m.senderId;
                return (
                  <Fragment key={m.id}>
                    {newDay ? (
                      <li className="flex justify-center py-1">
                        <span className="rounded-full bg-purple-50 px-4 py-1 text-caption font-medium text-neutral-700">{dayLabel(m.at)}</span>
                      </li>
                    ) : null}
                    <MessageRow
                      message={m}
                      showAvatar={runStart}
                      showName={detail.kind === "group" && runStart && !m.mine}
                      read={m.mine && readAt >= new Date(m.at).getTime()}
                      canEdit={!detail.blocked}
                      onDelete={() => setToDelete(m)}
                      onEdit={() => setEditing(m)}
                      onToggleLike={() => void toggleLike(m)}
                      onOpenFile={() => openFile(m)}
                    />
                  </Fragment>
                );
              })}
              {typing.length ? (
                <li className="flex items-end gap-3">
                  <span className="size-10 shrink-0" aria-hidden />
                  <span className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-neutral-100 px-5" aria-label={`${typing.join(", ")} ${typing.length > 1 ? "estão" : "está"} digitando`}>
                    {[0, 1, 2].map((d) => (
                      <span key={d} aria-hidden className="size-2 animate-bounce rounded-full bg-neutral-400 motion-reduce:animate-none" style={{ animationDelay: `${d * 150}ms` }} />
                    ))}
                  </span>
                </li>
              ) : null}
            </ol>
          </>
        )}
      </div>

      {detail.blocked ? (
        <div className="border-t border-line bg-neutral-50 px-5 py-4 text-center">
          <p className="text-body-sm text-neutral-700">{detail.blocked}</p>
          {detail.otherId && detail.blocked.includes("amigos") ? (
            <Button
              variant="soft"
              size="sm"
              className="mt-3"
              onClick={() =>
                props.onRequestFriend
                  ? props.onRequestFriend(detail.otherId!)
                  : friendsApi
                      .request(detail.otherId!)
                      .then(() => toast({ tone: "success", title: "Pedido de amizade enviado." }))
                      .catch((error) => toast({ tone: "error", title: "Não foi possível enviar o pedido.", description: errorMessage(error) }))
              }
            >
              <UserPlus aria-hidden /> Enviar pedido de amizade
            </Button>
          ) : null}
        </div>
      ) : (
        <Composer
          conversationId={id}
          compact={dock}
          editing={editing}
          onCancelEdit={() => setEditing(null)}
          onSent={(message) => {
            stickToBottom.current = true;
            setMessages((current) => mergeMessages(current, [message]));
            onActivity();
          }}
          onEdited={(message) => {
            setEditing(null);
            setMessages((current) => mergeMessages(current, [message]));
            onActivity();
          }}
        />
      )}
      <Lightbox items={lightboxItems} index={viewing !== null && viewing >= 0 ? viewing : null} onIndexChange={setViewing} onClose={() => setViewing(null)} />

      <Modal
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Apagar mensagem?"
        description="Ela será apagada para todas as pessoas da conversa. O texto e o anexo não podem ser recuperados."
        footer={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 aria-hidden /> Apagar
            </Button>
          </>
        }
      />
      <span className="sr-only" aria-live="polite">
        {meId && typing.length ? `${typing.join(", ")} digitando` : ""}
      </span>
    </section>
  );
}

type HeaderProps = Props & { titleId: string; other: ConversationDetail["members"][number] | null; otherOnline: boolean; typing: string[] };

/** Linha de status: digitando, participantes do grupo, online agora ou o cargo. */
function statusOf({ detail, other, otherOnline, typing }: HeaderProps): ReactNode {
  const isGroup = detail.kind === "group";
  if (typing.length) return <span className="text-purple-600">{isGroup ? `${typing.join(", ")} ${typing.length > 1 ? "estão" : "está"} digitando…` : "digitando…"}</span>;
  if (isGroup) return `${detail.members.length} ${detail.members.length === 1 ? "pessoa" : "pessoas"}`;
  if (otherOnline)
    return (
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-full bg-green-500" /> Online agora
      </span>
    );
  return other?.position ?? "";
}

function ConversationAvatar({ detail, other, otherOnline, size = "lg" }: { detail: ConversationDetail; other: HeaderProps["other"]; otherOnline: boolean; size?: "md" | "lg" }) {
  if (detail.kind === "group") {
    return (
      <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600", size === "lg" ? "size-12" : "size-10")}>
        <UsersRound className={size === "lg" ? "size-6" : "size-5"} />
      </span>
    );
  }
  return <PresenceAvatar name={other?.name ?? detail.title} image={other?.image ?? null} online={otherOnline} size={size} />;
}

/** Cabeçalho da janela flutuante: quem é, status e minimizar / abrir na página / fechar. */
function DockHeader(props: HeaderProps) {
  const { detail, other, otherOnline, titleId, onMinimize, onClose } = props;
  return (
    <header className="flex items-center gap-2.5 border-b border-line bg-gradient-to-r from-purple-50 to-white py-2.5 pl-3 pr-2">
      <button
        type="button"
        onClick={onMinimize}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
        aria-label={`Minimizar conversa com ${detail.title}`}
      >
        <ConversationAvatar detail={detail} other={other} otherOnline={otherOnline} size="md" />
        <span className="min-w-0 flex-1">
          <span id={titleId} className="flex items-center gap-1 text-body-sm font-bold text-neutral-900">
            <span className="truncate">{detail.title}</span>
            {other ? <MoodMark mood={other.mood} inline className="size-5" /> : null}
          </span>
          <span className="block truncate text-caption text-neutral-600">{statusOf(props)}</span>
        </span>
      </button>
      <Tooltip content="Abrir na página de conversas">
        <Link
          href={`/conversas?conversa=${detail.id}` as Route}
          onClick={onClose}
          aria-label="Abrir na página de conversas"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-700 hover:bg-purple-100 hover:text-purple-700 focus-visible:outline-2 focus-visible:outline-purple-500 [&_svg]:size-4"
        >
          <Maximize2 />
        </Link>
      </Tooltip>
      <IconButton label="Minimizar" variant="plain" size="sm" onClick={onMinimize}>
        <Minus />
      </IconButton>
      <IconButton label="Fechar conversa" variant="plain" size="sm" onClick={onClose}>
        <X />
      </IconButton>
    </header>
  );
}

function ChatHeader(props: HeaderProps) {
  const { detail, other, otherOnline, titleId, panelOpen, onTogglePanel, onBack, onAddMembers, onRename, onLeave, onUnfriend, onPopOut } = props;
  const isGroup = detail.kind === "group";
  const admin = detail.myRole === "admin";
  const status = statusOf(props);

  return (
    <header className="flex items-center gap-3 border-b border-line px-4 py-3.5 sm:px-6">
      <IconButton label="Voltar para a lista" variant="plain" className="xl:hidden" onClick={onBack}>
        <ArrowLeft />
      </IconButton>
      <ConversationAvatar detail={detail} other={other} otherOnline={otherOnline} />
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="flex items-center gap-1.5 text-h4 font-bold text-neutral-900">
          <span className="truncate">{detail.title}</span>
          {other ? <MoodMark mood={other.mood} /> : null}
        </h2>
        <p className="truncate text-caption text-neutral-600">{status}</p>
      </div>
      {onPopOut ? (
        <Tooltip content="Continuar em janela flutuante e navegar pela plataforma">
          <IconButton label="Abrir em janela flutuante" onClick={onPopOut} className="max-lg:hidden">
            <PictureInPicture2 />
          </IconButton>
        </Tooltip>
      ) : null}
      <IconButton label={panelOpen ? "Ocultar detalhes" : isGroup ? "Detalhes do grupo" : "Ver perfil ao lado"} aria-pressed={panelOpen} onClick={onTogglePanel} className="max-xl:hidden">
        <Info />
      </IconButton>
      <Menu>
        <MenuTrigger asChild>
          <IconButton label="Mais opções da conversa">
            <MoreVertical />
          </IconButton>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onTogglePanel}>
            <Info aria-hidden /> {isGroup ? "Detalhes do grupo" : "Detalhes da conversa"}
          </MenuItem>
          {onPopOut ? (
            <MenuItem onSelect={onPopOut}>
              <PictureInPicture2 aria-hidden /> Abrir em janela flutuante
            </MenuItem>
          ) : null}
          {other ? (
            <MenuItem asChild>
              <Link href={`/pessoas/${other.id}` as Route}>
                <UserRound aria-hidden /> Ver perfil
              </Link>
            </MenuItem>
          ) : null}
          {isGroup && admin ? (
            <>
              <MenuItem onSelect={onAddMembers}>
                <UserPlus aria-hidden /> Adicionar pessoas
              </MenuItem>
              <MenuItem onSelect={onRename}>
                <Pencil aria-hidden /> Renomear grupo
              </MenuItem>
            </>
          ) : null}
          <MenuSeparator />
          {isGroup ? (
            <MenuItem onSelect={onLeave} className="text-red-700 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700">
              <LogOut aria-hidden /> Sair do grupo
            </MenuItem>
          ) : other && !detail.blocked && onUnfriend ? (
            <MenuItem onSelect={() => onUnfriend(other.id)} className="text-red-700 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700">
              <UserMinus aria-hidden /> Desfazer amizade
            </MenuItem>
          ) : null}
        </MenuContent>
      </Menu>
    </header>
  );
}

function EmptyConversation({ detail }: { detail: ConversationDetail }) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-10 text-center">
      <p className="text-h4 font-semibold text-neutral-900">{detail.kind === "group" ? "Grupo criado!" : "Comece a conversa"}</p>
      <p className="mt-1 max-w-xs text-body-sm text-neutral-600">{detail.kind === "group" ? "Mande a primeira mensagem para o grupo." : `Diga um oi para ${detail.title.split(" ")[0]} 👋`}</p>
    </div>
  );
}

type RowProps = {
  message: ChatMessage;
  showAvatar: boolean;
  showName: boolean;
  read: boolean;
  canEdit: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onToggleLike: () => void;
  onOpenFile: () => void;
};

/** Botão de curtir que aparece ao passar o mouse (ou no foco) ao lado da bolha. */
function LikeButton({ message: m, onToggle }: { message: ChatMessage; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={m.likedByMe}
      aria-label={m.likedByMe ? "Descurtir mensagem" : "Curtir mensagem"}
      className={cn(
        "rounded-full p-1.5 transition-opacity hover:bg-pink-50 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-purple-500 group-hover:opacity-100",
        m.likedByMe ? "text-red-500 opacity-0" : "text-neutral-500 opacity-0",
      )}
    >
      <Heart className={cn("size-4", m.likedByMe && "fill-current")} />
    </button>
  );
}

/** Contador de curtidas sob a bolha (nomes no hover); clicar curte/descurte. */
function Likes({ message: m, onToggle, align }: { message: ChatMessage; onToggle: () => void; align: "start" | "end" }) {
  if (m.likes === 0 || m.deleted) return null;
  const names = m.likedBy;
  return (
    <div className={cn("-mt-2 flex", align === "end" ? "justify-end pr-2" : "pl-2")}>
      <Tooltip content={`Curtido por ${names.join(", ")}`}>
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${m.likes} ${m.likes === 1 ? "curtida" : "curtidas"}: ${names.join(", ")}. ${m.likedByMe ? "Descurtir" : "Curtir"}`}
          className="relative inline-flex h-6 items-center gap-1 rounded-full border border-line bg-white px-2 text-caption font-semibold text-neutral-700 shadow-sm hover:border-pink-100 hover:bg-pink-50 focus-visible:outline-2 focus-visible:outline-purple-500"
        >
          <Heart aria-hidden className="size-3.5 fill-red-500 text-red-500" />
          {m.likes > 1 ? m.likes : null}
        </button>
      </Tooltip>
    </div>
  );
}

function MessageBody({ message: m, mine, onOpenFile }: { message: ChatMessage; mine: boolean; onOpenFile: () => void }) {
  if (m.deleted) return <p className="text-body-sm italic">{mine ? "Você apagou esta mensagem" : "Mensagem apagada"}</p>;
  return (
    <>
      {m.file ? <Attachment file={m.file} mine={mine} onOpen={onOpenFile} /> : null}
      {m.body ? <MessageText text={m.body} mine={mine} /> : null}
    </>
  );
}

function MessageRow({ message: m, showAvatar, showName, read, canEdit, onDelete, onEdit, onToggleLike, onOpenFile }: RowProps) {
  // Duplo clique na bolha curte (como nos apps de mensagem); o botão de coração faz o mesmo pelo teclado.
  const onDoubleClick = m.deleted ? undefined : onToggleLike;
  if (m.mine) {
    return (
      <li className="group flex flex-col items-end gap-0 pl-10 sm:pl-16">
        <div className="flex max-w-full items-center justify-end gap-1">
          {!m.deleted ? (
            <>
              <LikeButton message={m} onToggle={onToggleLike} />
              <Menu>
                <MenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Opções da mensagem"
                    className="rounded-full p-1.5 text-neutral-500 opacity-0 transition-opacity hover:bg-neutral-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-purple-500 group-hover:opacity-100 data-[state=open]:opacity-100"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </MenuTrigger>
                <MenuContent>
                  {canEdit ? (
                    <MenuItem onSelect={onEdit}>
                      <Pencil aria-hidden /> Editar mensagem
                    </MenuItem>
                  ) : null}
                  <MenuItem onSelect={onDelete} className="text-red-700 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700">
                    <Trash2 aria-hidden /> Apagar mensagem
                  </MenuItem>
                </MenuContent>
              </Menu>
            </>
          ) : null}
          <div
            onDoubleClick={onDoubleClick}
            className={cn("max-w-[min(32rem,85%)] select-text rounded-2xl rounded-br-md px-4 pb-2 pt-3 shadow-sm", m.deleted ? "border border-line bg-white text-neutral-600" : "bg-purple-500 text-white")}
          >
            <MessageBody message={m} mine onOpenFile={onOpenFile} />
            <p className={cn("mt-1 flex items-center justify-end gap-1 text-[11px]", m.deleted ? "text-neutral-500" : "text-white/85")}>
              {m.edited ? <span>editada ·</span> : null}
              <time dateTime={m.at}>{timeOf(m.at)}</time>
              {!m.deleted ? read ? <CheckCheck aria-label="Lida" className="size-4" /> : <Check aria-label="Enviada" className="size-4" /> : null}
            </p>
          </div>
        </div>
        <Likes message={m} onToggle={onToggleLike} align="end" />
      </li>
    );
  }
  return (
    <li className="group flex items-start gap-3 pr-10 sm:pr-16">
      {showAvatar ? <Avatar name={m.senderName} src={m.senderImage} size="md" className="mt-0.5 ring-0" /> : <span aria-hidden className="size-10 shrink-0" />}
      <div className="min-w-0 max-w-[min(32rem,85%)]">
        {showName ? <p className="mb-1 text-caption font-semibold text-purple-700">{m.senderName}</p> : null}
        <div className="flex items-center gap-1">
          <div onDoubleClick={onDoubleClick} className={cn("min-w-0 rounded-2xl rounded-tl-md px-4 py-3", m.deleted ? "border border-line bg-white text-neutral-600" : "bg-neutral-100 text-neutral-900")}>
            <MessageBody message={m} mine={false} onOpenFile={onOpenFile} />
          </div>
          {!m.deleted ? <LikeButton message={m} onToggle={onToggleLike} /> : null}
        </div>
        <Likes message={m} onToggle={onToggleLike} align="start" />
        <p className="mt-1 text-[11px] text-neutral-600">
          <span className="sr-only">{m.senderName}, </span>
          <time dateTime={m.at}>{timeOf(m.at)}</time>
          {m.edited ? <span> · editada</span> : null}
        </p>
      </div>
    </li>
  );
}

/**
 * Campo de mensagem: Enter envia, Shift+Enter quebra a linha; emoji e anexo (PDF ou imagem).
 * Com `editing`, corrige o texto de uma mensagem própria (Enter salva, Esc cancela).
 */
function Composer({
  conversationId,
  compact = false,
  editing,
  onCancelEdit,
  onSent,
  onEdited,
}: {
  conversationId: string;
  /** Janela flutuante: sem o botão "+" (o clipe anexa) e espaçamentos menores. */
  compact?: boolean;
  editing: ChatMessage | null;
  onCancelEdit: () => void;
  onSent: (message: ChatMessage) => void;
  onEdited: (message: ChatMessage) => void;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState("");
  // Entrar/sair da edição troca o texto do campo (e guarda o rascunho que estava sendo escrito).
  const [editingId, setEditingId] = useState<string | null>(null);
  if ((editing?.id ?? null) !== editingId) {
    setEditingId(editing?.id ?? null);
    if (editing) {
      if (!editingId) setDraft(text);
      setText(editing.body);
    } else {
      setText(draft);
    }
  }
  const [file, setFile] = useState<ChatFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  const picker = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);

  // Altura acompanha o texto (até ~5 linhas).
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

  function signalTyping() {
    const now = Date.now();
    if (now - lastTyping.current < TYPING_EVERY_MS) return;
    lastTyping.current = now;
    friendsApi.typing(conversationId).catch(() => undefined);
  }

  async function attach(selected: File | undefined) {
    if (!selected) return;
    setUploading(true);
    try {
      setFile(await friendsApi.upload(selected));
      field.current?.focus();
    } catch (error) {
      toast({ tone: "error", title: "Não foi possível anexar o arquivo.", description: errorMessage(error) });
    } finally {
      setUploading(false);
      if (picker.current) picker.current.value = "";
    }
  }

  // Ao entrar na edição, o foco vai para o campo com o cursor no fim.
  useEffect(() => {
    const el = field.current;
    if (!editing || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  async function saveEdit() {
    if (!editing || sending) return;
    const body = text.trim();
    if (!body && !editing.file) {
      toast({ tone: "error", title: "A mensagem não pode ficar vazia.", description: "Para tirá-la da conversa, use “Apagar mensagem”." });
      return;
    }
    if (body === editing.body.trim()) return onCancelEdit();
    setSending(true);
    try {
      onEdited(await friendsApi.editMessage(conversationId, editing.id, body));
    } catch (error) {
      toast({ tone: "error", title: "Não foi possível editar a mensagem.", description: errorMessage(error) });
    } finally {
      setSending(false);
      field.current?.focus();
    }
  }

  async function send() {
    if (editing) return saveEdit();
    const body = text.trim();
    if ((!body && !file) || sending || uploading) return;
    setSending(true);
    try {
      const message = await friendsApi.send(conversationId, { body, fileId: file?.id ?? null });
      setText("");
      setFile(null);
      lastTyping.current = 0;
      onSent(message);
    } catch (error) {
      toast({ tone: "error", title: "Mensagem não enviada.", description: errorMessage(error) });
    } finally {
      setSending(false);
      field.current?.focus();
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
    if (e.key === "Escape" && editing) {
      e.preventDefault();
      onCancelEdit();
    }
  };

  const openPicker = (accept: string) => {
    if (!picker.current) return;
    picker.current.accept = accept;
    picker.current.click();
  };

  return (
    <div className={cn("border-t border-line", compact ? "px-3 py-2.5" : "px-4 py-3.5 sm:px-6")}>
      {editing ? (
        <div className="mb-2.5 flex items-center gap-3 rounded-lg border-l-4 border-purple-500 bg-purple-50 px-3 py-2">
          <Pencil aria-hidden className="size-4 shrink-0 text-purple-600" />
          <span className="min-w-0 flex-1">
            <span className="block text-caption font-semibold text-purple-700">Editando mensagem</span>
            <span className="block truncate text-caption text-neutral-700">{editing.body || editing.file?.name}</span>
          </span>
          <IconButton label="Cancelar edição" variant="plain" size="sm" onClick={onCancelEdit}>
            <X />
          </IconButton>
        </div>
      ) : null}
      {!editing && (file || uploading) ? (
        <div className="mb-2.5 flex items-center gap-3 rounded-lg border border-purple-100 bg-purple-50 px-3 py-2">
          <span aria-hidden className="flex size-9 items-center justify-center rounded-md bg-white text-purple-600">
            {uploading ? <Spinner className="size-4" /> : file?.mimeType.startsWith("image/") ? <ImageIcon className="size-5" /> : <FileText className="size-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body-sm font-medium text-neutral-900">{uploading ? "Enviando anexo…" : file?.name}</span>
            {file ? <span className="block text-caption text-neutral-600">{fileSize(file.sizeBytes)}</span> : null}
          </span>
          {file ? (
            <IconButton label="Remover anexo" variant="plain" size="sm" onClick={() => setFile(null)}>
              <X />
            </IconButton>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-end gap-3">
        {compact ? null : (
          <Menu>
            <MenuTrigger asChild>
              <IconButton label="Anexar" size="lg" className="mb-0.5 shrink-0" disabled={uploading || Boolean(editing)}>
                <Plus />
              </IconButton>
            </MenuTrigger>
            <MenuContent align="start" side="top">
              <MenuItem onSelect={() => openPicker("image/png,image/jpeg,image/webp")}>
                <ImageIcon aria-hidden /> Foto ou imagem
              </MenuItem>
              <MenuItem onSelect={() => openPicker("application/pdf")}>
                <FileText aria-hidden /> Documento PDF
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
        <div
          className={cn(
            "flex min-w-0 flex-1 items-end rounded-[26px] border border-line bg-white pr-1.5 transition-colors focus-within:border-purple-400 focus-within:ring-4 focus-within:ring-purple-100",
            compact ? "min-h-11 pl-4" : "min-h-[52px] pl-5",
          )}
        >
          <label htmlFor={fieldId} className="sr-only">
            Mensagem
          </label>
          <textarea
            id={fieldId}
            ref={field}
            rows={1}
            value={text}
            maxLength={4000}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value.trim()) signalTyping();
            }}
            onKeyDown={onKeyDown}
            placeholder={compact ? "Mensagem…" : "Digite uma mensagem…"}
            className={cn("max-h-[132px] min-w-0 flex-1 resize-none bg-transparent text-body-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none", compact ? "py-[11px]" : "py-[13px]")}
          />
          <div className="flex items-center gap-0.5 py-1.5">
            <EmojiPicker label="Inserir emoji" onPick={(emoji) => field.current && insertAtCaret(field.current, emoji)} />
            <IconButton label="Anexar arquivo" variant="plain" size={compact ? "sm" : "md"} onClick={() => openPicker(ACCEPT)} disabled={uploading || Boolean(editing)} className={compact ? undefined : "max-sm:hidden"}>
              <Paperclip />
            </IconButton>
            <IconButton
              label={editing ? "Salvar edição" : "Enviar mensagem"}
              variant="soft"
              size={compact ? "sm" : "md"}
              onClick={() => void send()}
              disabled={sending || uploading || (!editing && !text.trim() && !file)}
              className="bg-purple-500 text-white shadow-md hover:bg-purple-600 disabled:opacity-100 disabled:bg-purple-200"
            >
              {sending ? <Spinner className="size-5" /> : editing ? <Check /> : <SendHorizontal />}
            </IconButton>
          </div>
        </div>
        <input ref={picker} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void attach(e.target.files?.[0])} />
      </div>
    </div>
  );
}
