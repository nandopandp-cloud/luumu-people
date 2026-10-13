"use client";

import { MessageCirclePlus, Search, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/design-system/components/button";
import { Modal } from "@/design-system/components/dialog";
import { Skeleton } from "@/design-system/components/feedback";
import { Input } from "@/design-system/components/field";
import { useToast } from "@/design-system/components/toast";
import { errorMessage, friendsApi } from "./client";
import { MoodMark, PresenceAvatar } from "./person-bits";
import type { PersonCard } from "./types";

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Iniciar conversa: escolhe um amigo (conversa privada só entre amigos) e abre
 * a conversa — a existente, se houver. Também leva à criação de grupo.
 */
export function NewConversationDialog({
  open,
  onOpenChange,
  onOpened,
  onNewGroup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpened: (conversationId: string) => void;
  onNewGroup?: () => void;
}) {
  const toast = useToast();
  const [friends, setFriends] = useState<PersonCard[] | null>(null);
  const [search, setSearch] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSearch("");
      setFriends(null);
    }
  }
  useEffect(() => {
    if (!open) return;
    let alive = true;
    friendsApi
      .friends()
      .then((r) => alive && setFriends(r.items))
      .catch(() => alive && setFriends([]));
    return () => {
      alive = false;
    };
  }, [open]);

  const visible = useMemo(() => {
    const term = normalize(search);
    return (friends ?? []).filter((f) => !term || normalize(`${f.name} ${f.position ?? ""} ${f.orgUnit ?? ""}`).includes(term));
  }, [friends, search]);

  async function start(person: PersonCard) {
    setOpening(person.id);
    try {
      const { id } = await friendsApi.open({ kind: "direct", userId: person.id });
      onOpenChange(false);
      onOpened(id);
    } catch (error) {
      toast({ tone: "error", title: "Não foi possível abrir a conversa.", description: errorMessage(error) });
    } finally {
      setOpening(null);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Nova conversa"
      description="Escolha uma das suas conexões para conversar."
      footer={
        onNewGroup ? (
          <Button
            variant="ghost"
            className="mr-auto"
            onClick={() => {
              onOpenChange(false);
              onNewGroup();
            }}
          >
            <UsersRound aria-hidden /> Criar conversa em grupo
          </Button>
        ) : undefined
      }
    >
      <Input type="search" aria-label="Buscar conexões" placeholder="Buscar por nome, cargo ou área…" value={search} onChange={(e) => setSearch(e.target.value)} leading={<Search />} autoFocus />
      {friends === null ? (
        <div aria-hidden className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : friends.length === 0 ? (
        <div className="mt-4 rounded-lg bg-neutral-50 p-4 text-center">
          <p className="text-body-sm text-neutral-700">Você ainda não tem conexões. Conecte-se com colegas para conversar.</p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/amigos" onClick={() => onOpenChange(false)}>
              Encontrar pessoas
            </Link>
          </Button>
        </div>
      ) : (
        <ul aria-label="Conexões" className="relative mt-3 max-h-80 space-y-1 overflow-y-auto overscroll-y-contain pr-1">
          {visible.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => void start(f)}
                disabled={opening !== null}
                aria-label={`Conversar com ${f.name}`}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-500 disabled:opacity-60"
              >
                <PresenceAvatar name={f.name} image={f.image} online={f.online} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-body-sm font-semibold text-neutral-900">
                    <span className="truncate">{f.name}</span>
                    <MoodMark mood={f.mood} inline className="size-5" />
                  </span>
                  <span className="block truncate text-caption text-neutral-600">{[f.position, f.orgUnit].filter(Boolean).join(" · ")}</span>
                </span>
                <MessageCirclePlus aria-hidden className="size-5 shrink-0 text-purple-600" />
              </button>
            </li>
          ))}
          {visible.length === 0 ? <li className="px-2 py-4 text-center text-body-sm text-neutral-600">Ninguém encontrado entre as suas conexões.</li> : null}
        </ul>
      )}
    </Modal>
  );
}
