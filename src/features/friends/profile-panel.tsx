"use client";

import { Check, ChevronLeft, ChevronRight, FileText, Link2, LogOut, MessageCircle, MoreHorizontal, Pencil, UserMinus, UserPlus, UsersRound, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AvatarGroup } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { Button, IconButton } from "@/design-system/components/button";
import { Drawer } from "@/design-system/components/dialog";
import { Skeleton } from "@/design-system/components/feedback";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/design-system/components/menu";
import { cn } from "@/design-system/cn";
import { ProfileCoverArt } from "@/design-system/illustrations/profile-cover";
import { fileSize, friendsApi } from "./client";
import { MoodMark, MoodStatusPill, OnlinePill, PresenceAvatar, shortWhen } from "./person-bits";
import type { ConversationDetail, PersonProfile, Relation, SharedMedia } from "./types";

export type FriendActions = {
  request: (userId: string) => Promise<void>;
  accept: (userId: string) => Promise<void>;
  dismiss: (userId: string) => Promise<void>;
  unfriend: (userId: string) => void;
  message: (userId: string) => Promise<void>;
  openConversation: (id: string) => void;
};

/** Botões conforme a relação com a pessoa (`compact`: só ícones, para as linhas das listas). */
export function RelationActions({
  person,
  actions,
  inConversation,
  size = "md",
  compact,
}: {
  person: { id: string; relation: Relation; name: string };
  actions: FriendActions;
  inConversation?: boolean;
  size?: "sm" | "md";
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const first = person.name.split(" ")[0];
  if (compact) {
    if (person.relation === "friends") {
      return (
        <IconButton label={`Mensagem para ${person.name}`} variant="soft" disabled={busy} onClick={run(() => actions.message(person.id))}>
          <MessageCircle />
        </IconButton>
      );
    }
    if (person.relation === "received") {
      return (
        <div className="flex gap-1.5">
          <IconButton label={`Aceitar pedido de ${person.name}`} disabled={busy} onClick={run(() => actions.accept(person.id))} className="border-purple-500 bg-purple-500 text-white hover:bg-purple-600 hover:text-white">
            <Check />
          </IconButton>
          <IconButton label={`Recusar pedido de ${person.name}`} disabled={busy} onClick={run(() => actions.dismiss(person.id))}>
            <X />
          </IconButton>
        </div>
      );
    }
    if (person.relation === "sent") {
      return (
        <Button size="sm" variant="ghost" loading={busy} onClick={run(() => actions.dismiss(person.id))} title={`Cancelar o pedido para ${first}`} aria-label={`Pedido enviado: cancelar o pedido para ${person.name}`}>
          Enviado
        </Button>
      );
    }
    return (
      <Button size="sm" variant="secondary" loading={busy} onClick={run(() => actions.request(person.id))}>
        <UserPlus aria-hidden /> Adicionar<span className="sr-only"> {person.name} como amigo</span>
      </Button>
    );
  }
  if (person.relation === "friends") {
    return inConversation ? null : (
      <Button size={size} variant="soft" loading={busy} onClick={run(() => actions.message(person.id))}>
        <MessageCircle aria-hidden /> Mensagem
        <span className="sr-only"> para {person.name}</span>
      </Button>
    );
  }
  if (person.relation === "received") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size={size} loading={busy} onClick={run(() => actions.accept(person.id))}>
          <Check aria-hidden /> Aceitar<span className="sr-only"> pedido de {person.name}</span>
        </Button>
        <Button size={size} variant="ghost" disabled={busy} onClick={run(() => actions.dismiss(person.id))}>
          Recusar<span className="sr-only"> pedido de {person.name}</span>
        </Button>
      </div>
    );
  }
  if (person.relation === "sent") {
    return (
      <Button size={size} variant="ghost" loading={busy} onClick={run(() => actions.dismiss(person.id))} title={`Cancelar o pedido para ${first}`}>
        <X aria-hidden /> Cancelar pedido<span className="sr-only"> para {person.name}</span>
      </Button>
    );
  }
  return (
    <Button size={size} variant="secondary" loading={busy} onClick={run(() => actions.request(person.id))}>
      <UserPlus aria-hidden /> Adicionar<span className="sr-only"> {person.name} como amigo</span>
    </Button>
  );
}

function SectionTitle({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h3 className="text-body-sm font-bold text-neutral-900">{children}</h3>
      {action}
    </div>
  );
}

/** Cabeçalho do painel: capa (a da pessoa ou a ilustrada), avatar sobreposto e o botão de fechar. */
function Cover({ cover, onClose }: { cover: string | null; onClose?: () => void }) {
  return (
    <div className="relative h-36 overflow-hidden">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API
        <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <ProfileCoverArt className="absolute inset-0 size-full" />
      )}
      {onClose ? (
        <IconButton label="Fechar painel" onClick={onClose} className="absolute left-3 top-3 border-white/70 bg-white/95 shadow-sm">
          <ChevronLeft />
        </IconButton>
      ) : null}
    </div>
  );
}

function MediaSection({ conversationId }: { conversationId: string }) {
  const [media, setMedia] = useState<SharedMedia | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    friendsApi
      .media(conversationId)
      .then((m) => alive && setMedia(m))
      .catch(() => alive && setMedia({ images: [], files: [], links: [] }));
    return () => {
      alive = false;
    };
  }, [conversationId]);

  if (!media) return <Skeleton className="h-24 rounded-lg" />;
  const tiles = [...media.files.map((f) => ({ ...f, kind: "file" as const })), ...media.images.map((f) => ({ ...f, kind: "image" as const }))].sort((a, b) => b.at.localeCompare(a.at));
  const total = tiles.length + media.links.length;
  return (
    <section aria-label="Mídia, links e arquivos">
      <SectionTitle
        action={
          total > 0 ? (
            <IconButton label="Ver todas as mídias, links e arquivos" variant="plain" size="sm" onClick={() => setOpen(true)}>
              <ChevronRight />
            </IconButton>
          ) : undefined
        }
      >
        Mídia, links e arquivos
      </SectionTitle>
      {total === 0 ? (
        <p className="text-body-sm text-neutral-600">Fotos, documentos e links enviados na conversa aparecem aqui.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {tiles.slice(0, 3).map((t, i) => {
            const rest = tiles.length - 3;
            const overlay = i === 2 && rest > 0;
            return (
              <li key={t.id}>
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative flex h-[76px] flex-col justify-end overflow-hidden rounded-lg border border-line bg-neutral-50 p-2 hover:border-purple-200 focus-visible:outline-2 focus-visible:outline-purple-500"
                >
                  {t.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API
                    <img src={t.url} alt={t.name} className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <>
                      <span aria-hidden className="mb-auto flex size-6 items-center justify-center rounded bg-orange-100 text-orange-700">
                        <FileText className="size-3.5" />
                      </span>
                      <span className="block truncate text-[11px] font-semibold text-neutral-900">{t.name}</span>
                      <span className="block text-[10px] text-neutral-600">{fileSize(t.sizeBytes)}</span>
                    </>
                  )}
                  {overlay ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-neutral-900/45 text-body font-bold text-white">
                      +{rest}
                      <span className="sr-only"> arquivos</span>
                    </span>
                  ) : null}
                </a>
              </li>
            );
          })}
          {tiles.length === 0 && media.links.length > 0 ? (
            <li className="col-span-3 text-body-sm text-neutral-600">
              {media.links.length} {media.links.length === 1 ? "link compartilhado" : "links compartilhados"}
            </li>
          ) : null}
        </ul>
      )}
      <Drawer open={open} onOpenChange={setOpen} title="Mídia, links e arquivos">
        <div className="space-y-6">
          {media.images.length ? (
            <section>
              <h4 className="mb-2 text-body-sm font-bold text-neutral-900">Fotos</h4>
              <ul className="grid grid-cols-3 gap-2">
                {media.images.map((f) => (
                  <li key={f.id}>
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API */}
                      <img src={f.url} alt={f.name} className="size-full object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {media.files.length ? (
            <section>
              <h4 className="mb-2 text-body-sm font-bold text-neutral-900">Arquivos</h4>
              <ul className="divide-y divide-line">
                {media.files.map((f) => (
                  <li key={f.id}>
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5 hover:text-purple-700">
                      <FileText aria-hidden className="size-5 text-orange-700" />
                      <span className="min-w-0 flex-1 truncate text-body-sm font-medium">{f.name}</span>
                      <span className="text-caption text-neutral-600">{fileSize(f.sizeBytes)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {media.links.length ? (
            <section>
              <h4 className="mb-2 text-body-sm font-bold text-neutral-900">Links</h4>
              <ul className="divide-y divide-line">
                {media.links.map((l, i) => (
                  <li key={`${l.messageId}-${i}`}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5 hover:text-purple-700">
                      <Link2 aria-hidden className="size-5 shrink-0 text-blue-700" />
                      <span className="min-w-0 flex-1 truncate text-body-sm">{l.url}</span>
                      <span className="text-caption text-neutral-600">{shortWhen(l.at)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </Drawer>
    </section>
  );
}

/** Perfil do colega no painel lateral. */
export function PersonPanel({ userId, conversationId, actions, onClose, version }: { userId: string; conversationId?: string | null; actions: FriendActions; onClose?: () => void; version?: number }) {
  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    friendsApi
      .profile(userId)
      .then((p) => {
        if (!alive) return;
        setProfile(p);
        setFailed(false);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [userId, version]);

  if (failed) return <p className="p-6 text-body-sm text-neutral-600">Não foi possível carregar este perfil.</p>;
  if (!profile) return <PanelSkeleton />;
  const p = profile;
  return (
    <div>
      <Cover cover={p.cover} onClose={onClose} />
      <div className="-mt-16 flex flex-col items-center px-5 text-center">
        <PresenceAvatar name={p.name} image={p.image} online={p.online} size="xl" className="rounded-full ring-4 ring-white" />
        <h2 className="mt-3 flex items-center gap-1.5 text-h3 font-bold text-neutral-900">
          {p.name}
          <MoodMark mood={p.mood} />
        </h2>
        {p.position ? <p className="mt-0.5 text-body-sm text-neutral-700">{p.position}</p> : null}
        {p.orgUnit || p.location ? <p className="text-caption text-neutral-600">{[p.orgUnit, p.location].filter(Boolean).join(" • ")}</p> : null}
        {p.online || p.mood ? (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {p.online ? <OnlinePill /> : null}
            <MoodStatusPill mood={p.mood} />
          </div>
        ) : null}
        <div className="mt-4 flex w-full flex-col gap-2">
          <Button asChild variant="secondary" block>
            <Link href={`/amigos/${p.id}` as Route}>Ver perfil</Link>
          </Button>
          {p.relation !== "friends" || !conversationId ? (
            <div className="flex justify-center [&>*]:w-full [&_button]:w-full">
              <RelationActions person={p} actions={actions} inConversation={Boolean(conversationId)} />
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-6 space-y-6 px-5 pb-6">
        <section>
          <SectionTitle>Sobre</SectionTitle>
          <p className="text-body-sm text-neutral-600">{p.headline ? <>{p.headline}</> : `${p.name.split(" ")[0]} ainda não escreveu uma frase no perfil.`}</p>
        </section>
        <section>
          <SectionTitle>Em comum</SectionTitle>
          {p.mutualCount > 0 ? (
            <div className="flex items-center gap-3">
              <AvatarGroup people={p.mutualFriends.map((f) => ({ name: f.name, src: f.image }))} max={3} size="md" />
              <span className="text-body-sm text-neutral-600">
                {p.mutualCount} {p.mutualCount === 1 ? "amigo em comum" : "amigos em comum"}
              </span>
            </div>
          ) : (
            <p className="text-body-sm text-neutral-600">Nenhum amigo em comum ainda.</p>
          )}
        </section>
        {conversationId ? <MediaSection conversationId={conversationId} /> : null}
        <section>
          <SectionTitle>Grupos em comum</SectionTitle>
          {p.groupsInCommon.length ? (
            <ul className="space-y-1">
              {p.groupsInCommon.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => actions.openConversation(g.id)}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-500"
                  >
                    <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                      <UsersRound className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-semibold text-neutral-900">{g.title}</span>
                      <span className="block text-caption text-neutral-600">
                        {g.memberCount} {g.memberCount === 1 ? "membro" : "membros"}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-4 text-neutral-500" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-neutral-600">Nenhum grupo em comum.</p>
          )}
        </section>
      </div>
    </div>
  );
}

/** Detalhes do grupo no painel lateral: participantes, administração e mídia. */
export function GroupPanel({
  detail,
  meId,
  onClose,
  onAddMembers,
  onRename,
  onRemove,
  onLeave,
}: {
  detail: ConversationDetail;
  meId: string;
  onClose?: () => void;
  onAddMembers: () => void;
  onRename: () => void;
  onRemove: (userId: string, name: string) => void;
  onLeave: () => void;
}) {
  const admin = detail.myRole === "admin";
  return (
    <div>
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-purple-200 via-purple-100 to-pink-100">
        <ProfileCoverArt className="absolute inset-0 size-full opacity-70" />
        {onClose ? (
          <IconButton label="Fechar painel" onClick={onClose} className="absolute left-3 top-3 border-white/70 bg-white/95 shadow-sm">
            <ChevronLeft />
          </IconButton>
        ) : null}
      </div>
      <div className="relative -mt-14 flex flex-col items-center px-5 text-center">
        <span aria-hidden className="flex size-28 items-center justify-center rounded-full bg-purple-100 text-purple-600 ring-4 ring-white">
          <UsersRound className="size-12" />
        </span>
        <h2 className="mt-3 flex items-center gap-2 text-h3 font-bold text-neutral-900">
          {detail.title}
          {admin ? (
            <IconButton label="Renomear grupo" variant="plain" size="sm" onClick={onRename}>
              <Pencil />
            </IconButton>
          ) : null}
        </h2>
        <p className="text-body-sm text-neutral-600">
          Grupo · {detail.members.length} {detail.members.length === 1 ? "membro" : "membros"}
        </p>
        <div className="mt-4 flex w-full flex-col gap-2">
          {admin ? (
            <Button variant="secondary" block onClick={onAddMembers}>
              <UserPlus aria-hidden /> Adicionar pessoas
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-6 space-y-6 px-5 pb-6">
        <section>
          <SectionTitle>Participantes</SectionTitle>
          <ul className="space-y-1">
            {detail.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-lg p-1.5">
                <PresenceAvatar name={m.name} image={m.image} online={m.online} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-body-sm font-semibold text-neutral-900">
                    <span className="truncate">{m.id === meId ? `${m.name} (você)` : m.name}</span>
                    <MoodMark mood={m.mood} className="[&_img]:size-5" />
                  </span>
                  <span className="block truncate text-caption text-neutral-600">{m.position ?? ""}</span>
                </span>
                {m.role === "admin" ? (
                  <Badge tone="purple" size="sm">
                    Administração
                  </Badge>
                ) : null}
                {admin && m.id !== meId ? (
                  <Menu>
                    <MenuTrigger asChild>
                      <IconButton label={`Opções para ${m.name}`} variant="plain" size="sm">
                        <MoreHorizontal />
                      </IconButton>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem asChild>
                        <Link href={`/amigos/${m.id}` as Route}>Ver perfil</Link>
                      </MenuItem>
                      <MenuItem onSelect={() => onRemove(m.id, m.name)} className="text-red-700 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700">
                        <UserMinus aria-hidden /> Remover do grupo
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
        <MediaSection conversationId={detail.id} />
        <Button variant="destructive" block onClick={onLeave}>
          <LogOut aria-hidden /> Sair do grupo
        </Button>
      </div>
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="h-36 rounded-none" />
      <div className="-mt-14 flex flex-col items-center gap-3 px-5">
        <Skeleton className="size-28 rounded-full" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-2 h-10 w-full rounded-full" />
      </div>
      <div className={cn("mt-6 space-y-4 px-5")}>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
