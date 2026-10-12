"use client";

import { ArrowLeft, Check, CheckCheck, FileText, Image as ImageIcon, Info, LogOut, MoreHorizontal, MoreVertical, Paperclip, Pencil, Plus, SendHorizontal, Trash2, UserMinus, UserPlus, UserRound, UsersRound, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Button, IconButton } from "@/design-system/components/button";
import { Modal } from "@/design-system/components/dialog";
import { EmojiPicker, insertAtCaret } from "@/design-system/components/emoji-picker";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/design-system/components/menu";
import { Spinner } from "@/design-system/components/spinner";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { errorMessage, fileSize, friendsApi } from "./client";
import { dayLabel, MoodMark, PresenceAvatar, sameDay, timeOf } from "./person-bits";
import type { ChatFile, ChatMessage, ConversationDetail, MessagesPage } from "./types";

const POLL_MS = 3_000;
const TYPING_EVERY_MS = 3_000;
const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

type Props = {
  detail: ConversationDetail;
  meId: string;
  initial?: MessagesPage | null;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onBack: () => void;
  onRead: (id: string) => void;
  onActivity: () => void;
  onAddMembers: () => void;
  onRename: () => void;
  onLeave: () => void;
  onUnfriend: (userId: string) => void;
  onRequestFriend: (userId: string) => void;
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

function Attachment({ file, mine }: { file: ChatFile; mine: boolean }) {
  if (file.mimeType.startsWith("image/")) {
    return (
      <a href={file.url} target="_blank" rel="noopener noreferrer" className="mb-1.5 block overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-purple-500">
        {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API */}
        <img src={file.url} alt={file.name} className="max-h-60 w-full max-w-64 object-cover" />
      </a>
    );
  }
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("mb-1.5 flex items-center gap-3 rounded-lg px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-purple-500", mine ? "bg-white/15 hover:bg-white/25" : "bg-white hover:bg-purple-50")}
    >
      <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", mine ? "bg-white/20 text-white" : "bg-orange-100 text-orange-700")}>
        <FileText className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-body-sm font-semibold">{file.name}</span>
        <span className={cn("block text-caption", mine ? "text-white/80" : "text-neutral-600")}>{fileSize(file.sizeBytes)} · Abrir</span>
      </span>
    </a>
  );
}

export function ChatPanel(props: Props) {
  const { detail, meId, initial, onRead, onActivity } = props;
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>(initial?.items ?? []);
  const [hasMore, setHasMore] = useState(initial?.hasMore ?? false);
  const [othersReadAt, setOthersReadAt] = useState<string | null>(initial?.othersReadAt ?? null);
  const [typing, setTyping] = useState<string[]>(initial?.typing ?? []);
  const [online, setOnline] = useState<string[]>(initial?.online ?? detail.members.filter((m) => m.online).map((m) => m.id));
  const [loading, setLoading] = useState(!initial);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [toDelete, setToDelete] = useState<ChatMessage | null>(null);
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

  // Atualização periódica: mensagens novas (e apagadas), leitura, digitação e presença.
  useEffect(() => {
    let alive = true;
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
    const timer = window.setInterval(tick, POLL_MS);
    const onFocus = () => {
      void tick();
      markRead();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [id, markRead, onActivity]);

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
    <section aria-labelledby="conversa-titulo" className="card flex h-full min-h-0 flex-col overflow-hidden p-0">
      <ChatHeader {...props} other={other ?? null} otherOnline={otherOnline} typing={typing} />

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite" aria-relevant="additions">
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
                    <MessageRow message={m} showAvatar={runStart} showName={detail.kind === "group" && runStart && !m.mine} read={m.mine && readAt >= new Date(m.at).getTime()} onDelete={() => setToDelete(m)} />
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
            <Button variant="soft" size="sm" className="mt-3" onClick={() => props.onRequestFriend(detail.otherId!)}>
              <UserPlus aria-hidden /> Enviar pedido de amizade
            </Button>
          ) : null}
        </div>
      ) : (
        <Composer
          conversationId={id}
          onSent={(message) => {
            stickToBottom.current = true;
            setMessages((current) => mergeMessages(current, [message]));
            onActivity();
          }}
        />
      )}

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

function ChatHeader({
  detail,
  other,
  otherOnline,
  typing,
  panelOpen,
  onTogglePanel,
  onBack,
  onAddMembers,
  onRename,
  onLeave,
  onUnfriend,
}: Props & { other: ConversationDetail["members"][number] | null; otherOnline: boolean; typing: string[] }) {
  const isGroup = detail.kind === "group";
  const admin = detail.myRole === "admin";
  let status: ReactNode;
  if (typing.length) status = <span className="text-purple-600">{isGroup ? `${typing.join(", ")} ${typing.length > 1 ? "estão" : "está"} digitando…` : "digitando…"}</span>;
  else if (isGroup) status = `${detail.members.length} ${detail.members.length === 1 ? "pessoa" : "pessoas"}`;
  else if (otherOnline)
    status = (
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-full bg-green-500" /> Online agora
      </span>
    );
  else status = other?.position ?? "";

  return (
    <header className="flex items-center gap-3 border-b border-line px-4 py-3.5 sm:px-6">
      <IconButton label="Voltar para a lista" variant="plain" className="xl:hidden" onClick={onBack}>
        <ArrowLeft />
      </IconButton>
      {isGroup ? (
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
          <UsersRound className="size-6" />
        </span>
      ) : (
        <PresenceAvatar name={other?.name ?? detail.title} image={other?.image ?? null} online={otherOnline} />
      )}
      <div className="min-w-0 flex-1">
        <h2 id="conversa-titulo" className="flex items-center gap-1.5 text-h4 font-bold text-neutral-900">
          <span className="truncate">{detail.title}</span>
          {other ? <MoodMark mood={other.mood} /> : null}
        </h2>
        <p className="truncate text-caption text-neutral-600">{status}</p>
      </div>
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
          {other ? (
            <MenuItem asChild>
              <Link href={`/amigos/${other.id}` as Route}>
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
          ) : other && !detail.blocked ? (
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

function MessageRow({ message: m, showAvatar, showName, read, onDelete }: { message: ChatMessage; showAvatar: boolean; showName: boolean; read: boolean; onDelete: () => void }) {
  if (m.mine) {
    return (
      <li className="group flex items-center justify-end gap-2 pl-10 sm:pl-16">
        {!m.deleted ? (
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
              <MenuItem onSelect={onDelete} className="text-red-700 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700">
                <Trash2 aria-hidden /> Apagar mensagem
              </MenuItem>
            </MenuContent>
          </Menu>
        ) : null}
        <div className={cn("max-w-[min(32rem,85%)] rounded-2xl rounded-br-md px-4 pb-2 pt-3 shadow-sm", m.deleted ? "border border-line bg-white text-neutral-600" : "bg-purple-500 text-white")}>
          {m.deleted ? (
            <p className="text-body-sm italic">Você apagou esta mensagem</p>
          ) : (
            <>
              {m.file ? <Attachment file={m.file} mine /> : null}
              {m.body ? <MessageText text={m.body} mine /> : null}
            </>
          )}
          <p className={cn("mt-1 flex items-center justify-end gap-1 text-[11px]", m.deleted ? "text-neutral-500" : "text-white/85")}>
            <time dateTime={m.at}>{timeOf(m.at)}</time>
            {!m.deleted ? (
              read ? (
                <CheckCheck aria-label="Lida" className="size-4" />
              ) : (
                <Check aria-label="Enviada" className="size-4" />
              )
            ) : null}
          </p>
        </div>
      </li>
    );
  }
  return (
    <li className="flex items-start gap-3 pr-10 sm:pr-16">
      {showAvatar ? <Avatar name={m.senderName} src={m.senderImage} size="md" className="mt-0.5 ring-0" /> : <span aria-hidden className="size-10 shrink-0" />}
      <div className="min-w-0 max-w-[min(32rem,85%)]">
        {showName ? <p className="mb-1 text-caption font-semibold text-purple-700">{m.senderName}</p> : null}
        <div className={cn("rounded-2xl rounded-tl-md px-4 py-3", m.deleted ? "border border-line bg-white text-neutral-600" : "bg-neutral-100 text-neutral-900")}>
          {m.deleted ? (
            <p className="text-body-sm italic">Mensagem apagada</p>
          ) : (
            <>
              {m.file ? <Attachment file={m.file} mine={false} /> : null}
              {m.body ? <MessageText text={m.body} mine={false} /> : null}
            </>
          )}
        </div>
        <p className="mt-1 text-[11px] text-neutral-600">
          <span className="sr-only">{m.senderName}, </span>
          <time dateTime={m.at}>{timeOf(m.at)}</time>
        </p>
      </div>
    </li>
  );
}

/** Campo de mensagem: Enter envia, Shift+Enter quebra a linha; emoji e anexo (PDF ou imagem). */
function Composer({ conversationId, onSent }: { conversationId: string; onSent: (message: ChatMessage) => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [file, setFile] = useState<ChatFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
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

  async function send() {
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
  };

  const openPicker = (accept: string) => {
    if (!picker.current) return;
    picker.current.accept = accept;
    picker.current.click();
  };

  return (
    <div className="border-t border-line px-4 py-3.5 sm:px-6">
      {file || uploading ? (
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
        <Menu>
          <MenuTrigger asChild>
            <IconButton label="Anexar" size="lg" className="mb-0.5 shrink-0" disabled={uploading}>
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
        <div className="flex min-h-[52px] min-w-0 flex-1 items-end rounded-[26px] border border-line bg-white pl-5 pr-1.5 transition-colors focus-within:border-purple-400 focus-within:ring-4 focus-within:ring-purple-100">
          <label htmlFor={`mensagem-${conversationId}`} className="sr-only">
            Mensagem
          </label>
          <textarea
            id={`mensagem-${conversationId}`}
            ref={field}
            rows={1}
            value={text}
            maxLength={4000}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value.trim()) signalTyping();
            }}
            onKeyDown={onKeyDown}
            placeholder="Digite uma mensagem…"
            className="max-h-[132px] min-w-0 flex-1 resize-none bg-transparent py-[13px] text-body-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none"
          />
          <div className="flex items-center gap-0.5 py-1.5">
            <EmojiPicker label="Inserir emoji" onPick={(emoji) => field.current && insertAtCaret(field.current, emoji)} />
            <IconButton label="Anexar arquivo" variant="plain" onClick={() => openPicker(ACCEPT)} disabled={uploading} className="max-sm:hidden">
              <Paperclip />
            </IconButton>
            <IconButton
              label="Enviar mensagem"
              variant="soft"
              onClick={() => void send()}
              disabled={sending || uploading || (!text.trim() && !file)}
              className="bg-purple-500 text-white shadow-md hover:bg-purple-600 disabled:opacity-100 disabled:bg-purple-200"
            >
              {sending ? <Spinner className="size-5" /> : <SendHorizontal />}
            </IconButton>
          </div>
        </div>
        <input ref={picker} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void attach(e.target.files?.[0])} />
      </div>
    </div>
  );
}
