import type { Metadata } from "next";
import { Suspense } from "react";
import { FriendsApp, FriendsSkeleton } from "@/features/friends/friends-app";
import { requireActor } from "@/server/dal";
import { getConversation, listConversations, listMessages } from "@/server/modules/friends/conversations";
import { listRequests } from "@/server/modules/friends/service";
import { HttpError } from "@/server/http/errors";

export const metadata: Metadata = { title: "Conversas" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function FriendsPage({ searchParams }: PageProps<"/conversas">) {
  return (
    <Suspense fallback={<FriendsSkeleton />}>
      <Friends searchParams={searchParams} />
    </Suspense>
  );
}

/** Conversas, pedidos e (se houver) a conversa aberta na URL, já com as mensagens. */
async function Friends({ searchParams }: { searchParams: PageProps<"/conversas">["searchParams"] }) {
  const [actor, raw] = await Promise.all([requireActor(), searchParams]);
  const conversa = typeof raw.conversa === "string" && UUID.test(raw.conversa) ? raw.conversa : null;
  const [conversations, requests, open] = await Promise.all([
    listConversations(actor),
    listRequests(actor),
    conversa
      ? Promise.all([getConversation(actor, conversa), listMessages(actor, conversa, {})]).catch((error) => {
          // Conversa de que a pessoa não participa: abre a página sem ela.
          if (error instanceof HttpError && error.status === 404) return null;
          throw error;
        })
      : null,
  ]);
  return (
    <FriendsApp
      meId={actor.userId}
      initial={{ conversations, requests, detail: open?.[0] ?? null, messages: open?.[1] ?? null }}
    />
  );
}
