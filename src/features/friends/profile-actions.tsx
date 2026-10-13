"use client";

import { ArrowLeft, UserCheck, UserMinus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/design-system/components/button";
import { useToast } from "@/design-system/components/toast";
import { connectionsApi, errorMessage, friendsApi } from "./client";
import { chatDock } from "./dock-store";
import { ConfirmDialog } from "./group-dialogs";
import { RelationActions, type FriendActions } from "./profile-panel";
import type { Relation } from "./types";

/** Ações da página de perfil do colega (pedir, aceitar, mensagem, desfazer amizade). */
export function ProfileActions({ person }: { person: { id: string; name: string; relation: Relation; following: boolean; followers: number } }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const run = async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      if (success) toast({ tone: "success", title: success });
      router.refresh();
    } catch (error) {
      toast({ tone: "error", title: "Não foi possível concluir.", description: errorMessage(error) });
    }
  };
  const actions: FriendActions = {
    request: (id) => run(() => friendsApi.request(id), "Pedido de amizade enviado."),
    accept: (id) => run(() => friendsApi.accept(id), "Agora vocês são amigos! 💜"),
    dismiss: (id) => run(() => friendsApi.dismiss(id)),
    unfriend: () => setConfirm(true),
    async message(id) {
      try {
        // Abre no chat flutuante: a pessoa continua no perfil.
        const { id: conversation } = await friendsApi.open({ kind: "direct", userId: id });
        chatDock.open(conversation);
      } catch (error) {
        toast({ tone: "error", title: "Não foi possível abrir a conversa.", description: errorMessage(error) });
      }
    },
    openConversation: (id) => chatDock.open(id),
  };
  const [following, setFollowing] = useState(person.following);
  const [followers, setFollowers] = useState(person.followers);
  const [followBusy, setFollowBusy] = useState(false);
  async function toggleFollow() {
    setFollowBusy(true);
    try {
      const result = await connectionsApi.follow(person.id, !following);
      setFollowing(result.following);
      setFollowers(result.followers);
    } catch (error) {
      toast({ tone: "error", title: "Não foi possível seguir.", description: errorMessage(error) });
    } finally {
      setFollowBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-body-sm text-neutral-600">
        <strong className="font-semibold text-neutral-900">{followers}</strong> {followers === 1 ? "seguidor" : "seguidores"}
      </span>
      <Button variant={following ? "ghost" : "soft"} loading={followBusy} onClick={toggleFollow} aria-pressed={following}>
        {following ? (
          <>
            <UserCheck aria-hidden /> Seguindo
          </>
        ) : (
          "Seguir"
        )}
      </Button>
      <RelationActions person={person} actions={actions} />
      {person.relation === "friends" ? (
        <Button variant="ghost" onClick={() => setConfirm(true)}>
          <UserMinus aria-hidden /> Desfazer amizade
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Desfazer amizade?"
        description="A conversa de vocês fica no histórico, mas ninguém poderá enviar novas mensagens até que voltem a ser amigos."
        confirm="Desfazer amizade"
        onConfirm={() => run(() => friendsApi.unfriend(person.id), "Amizade desfeita.")}
      />
    </div>
  );
}

export function BackToFriends() {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href="/amigos">
        <ArrowLeft aria-hidden /> Conexões
      </Link>
    </Button>
  );
}
