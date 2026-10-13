"use client";

import { Check, MessageCircle, MoreVertical, UserCheck, UserMinus, UserPlus, UsersRound, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Button, IconButton } from "@/design-system/components/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/design-system/components/menu";
import { cn } from "@/design-system/cn";
import { paletteFor, ProfileCoverArt } from "@/design-system/illustrations/profile-cover";
import { MoodMark } from "@/features/friends/person-bits";
import type { ConnectionCard } from "@/features/friends/types";
import { InterestDot } from "./interest-icon";

/** Ações sobre uma pessoa (pedir, aceitar, recusar/cancelar, desfazer, seguir, mensagem). */
export type PersonActions = {
  connect: (card: ConnectionCard) => Promise<void>;
  accept: (card: ConnectionCard) => Promise<void>;
  dismissRequest: (card: ConnectionCard) => Promise<void>;
  unfriend: (card: ConnectionCard) => void;
  follow: (card: ConnectionCard) => Promise<void>;
  message: (card: ConnectionCard) => Promise<void>;
};

const profileHref = (id: string) => `/pessoas/${id}` as Route;

/** Avatar com o ponto de "online" (só amigos) e a ameixa do sentimento de hoje. */
function PersonAvatar({ card, size }: { card: ConnectionCard; size: "lg" | "xl" }) {
  return (
    <span className="relative inline-flex">
      <Avatar name={card.name} src={card.image} size="xl" className={cn("ring-4 ring-white", size === "xl" ? "size-20 text-h3" : "size-16 text-h4")} />
      {card.online ? <span role="img" aria-label="Online agora" className="absolute bottom-1 right-1 size-4 rounded-full bg-green-500 ring-[3px] ring-white" /> : null}
      {card.mood ? (
        <span className="absolute -right-3 bottom-0 flex size-8 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white">
          <MoodMark mood={card.mood} inline className="size-7" />
        </span>
      ) : null}
    </span>
  );
}

/** Por que a pessoa aparece: interesses em comum, amigos em comum, mesmo time ou a área. */
function Affinity({ card }: { card: ConnectionCard }) {
  const n = card.commonInterests.length;
  if (n > 0) {
    return (
      <div className="mt-3">
        <p className="whitespace-nowrap text-[11px] leading-4 text-neutral-600">
          {n} {n === 1 ? "interesse em comum" : "interesses em comum"}
        </p>
        <div className="mt-1.5 flex justify-center gap-1">
          {card.commonInterests.slice(0, 4).map((k) => (
            <InterestDot key={k} interest={k} />
          ))}
        </div>
      </div>
    );
  }
  const reason =
    card.mutualCount > 0 ? `${card.mutualCount} ${card.mutualCount === 1 ? "amigo em comum" : "amigos em comum"}` : card.sameTeam ? "Do seu time" : card.relation === "friends" ? "Sua conexão" : "Da empresa";
  return (
    <div className="mt-3">
      <p className="whitespace-nowrap text-[11px] leading-4 text-neutral-600">{reason}</p>
      <div className="mt-1.5 h-6" aria-hidden />
    </div>
  );
}

function RelationButton({ card, actions }: { card: ConnectionCard; actions: PersonActions }) {
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const base = "w-full";
  if (card.relation === "friends") {
    return (
      <Button variant="soft" className={base} loading={busy} onClick={run(() => actions.message(card))} aria-label={`Mensagem para ${card.name}`}>
        <MessageCircle aria-hidden /> Mensagem
      </Button>
    );
  }
  if (card.relation === "received") {
    return (
      <div className="flex w-full gap-2">
        <Button className="flex-1 px-3" loading={busy} onClick={run(() => actions.accept(card))} aria-label={`Aceitar pedido de ${card.name}`}>
          Aceitar
        </Button>
        <IconButton label={`Recusar pedido de ${card.name}`} disabled={busy} onClick={run(() => actions.dismissRequest(card))}>
          <X />
        </IconButton>
      </div>
    );
  }
  if (card.relation === "sent") {
    return (
      <Button variant="ghost" className={base} loading={busy} onClick={run(() => actions.dismissRequest(card))} title="Cancelar o pedido" aria-label={`Pedido enviado: cancelar o pedido para ${card.name}`}>
        <Check aria-hidden /> Pedido enviado
      </Button>
    );
  }
  return (
    <Button variant="secondary" className={base} loading={busy} onClick={run(() => actions.connect(card))} aria-label={`Conectar com ${card.name}`}>
      <UsersRound aria-hidden /> Conectar
    </Button>
  );
}

/** Cartão de pessoa (sugestões, busca, conexões e pedidos). */
export function PersonTile({ card, actions, onDismiss, menu }: { card: ConnectionCard; actions: PersonActions; onDismiss?: (card: ConnectionCard) => void; menu?: ReactNode }) {
  return (
    <article aria-labelledby={`pessoa-${card.id}`} className="relative flex h-full flex-col items-center rounded-xl border border-line bg-white px-3 pb-3 pt-5 text-center transition-shadow hover:shadow-md">
      {onDismiss ? (
        <IconButton label={`Dispensar sugestão: ${card.name}`} variant="plain" size="sm" className="absolute right-1.5 top-1.5 text-neutral-500" onClick={() => onDismiss(card)}>
          <X />
        </IconButton>
      ) : null}
      {menu ? <div className="absolute right-1.5 top-1.5">{menu}</div> : null}
      <Link href={profileHref(card.id)} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500" tabIndex={-1} aria-hidden>
        <PersonAvatar card={card} size="xl" />
      </Link>
      <h3 id={`pessoa-${card.id}`} className="mt-3 line-clamp-1 text-body font-bold text-neutral-900">
        <Link href={profileHref(card.id)} className="hover:text-purple-700 focus-visible:outline-2 focus-visible:outline-purple-500">
          {card.name}
        </Link>
      </h3>
      <p className="line-clamp-1 text-body-sm text-neutral-700">{card.position ?? "—"}</p>
      <p className="line-clamp-1 text-caption text-neutral-600">{card.orgUnit ?? ""}</p>
      <Affinity card={card} />
      <div className="mt-auto w-full pt-3">
        <RelationButton card={card} actions={actions} />
      </div>
    </article>
  );
}

/** Menu "…" do cartão de uma conexão: ver perfil e desfazer amizade. */
export function FriendMenu({ card, actions }: { card: ConnectionCard; actions: PersonActions }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label={`Opções para ${card.name}`} variant="plain" size="sm" className="text-neutral-500">
          <MoreVertical />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        <MenuItem asChild>
          <Link href={profileHref(card.id)}>Ver perfil</Link>
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => actions.unfriend(card)} className="text-red-700 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700">
          <UserMinus aria-hidden /> Desfazer amizade
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/** Cartão de "Pessoas em destaque": capa, avatar, presença e Seguir. */
export function FeaturedTile({ card, actions }: { card: ConnectionCard; actions: PersonActions }) {
  const [busy, setBusy] = useState(false);
  const follow = async () => {
    setBusy(true);
    try {
      await actions.follow(card);
    } finally {
      setBusy(false);
    }
  };
  return (
    <article aria-labelledby={`destaque-${card.id}`} className="relative flex flex-col overflow-hidden rounded-xl border border-line bg-white transition-shadow hover:shadow-md">
      <div className="relative h-20">
        {card.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API
          <img src={card.cover} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <ProfileCoverArt palette={paletteFor(card.id)} className="absolute inset-0 size-full" />
        )}
        <Menu>
          <MenuTrigger asChild>
            <IconButton label={`Opções para ${card.name}`} size="sm" className="absolute right-2 top-2 border-white/80 bg-white/95 shadow-sm">
              <MoreVertical />
            </IconButton>
          </MenuTrigger>
          <MenuContent>
            <MenuItem asChild>
              <Link href={profileHref(card.id)}>Ver perfil</Link>
            </MenuItem>
            {card.relation === "friends" ? (
              <MenuItem onSelect={() => void actions.message(card)}>
                <MessageCircle aria-hidden /> Enviar mensagem
              </MenuItem>
            ) : card.relation === "none" ? (
              <MenuItem onSelect={() => void actions.connect(card)}>
                <UserPlus aria-hidden /> Conectar
              </MenuItem>
            ) : null}
          </MenuContent>
        </Menu>
      </div>
      <div className="flex flex-1 flex-col px-4 pb-3">
        <div className="-mt-8 flex items-end gap-2">
          <Link href={profileHref(card.id)} tabIndex={-1} aria-hidden className="rounded-full">
            <PersonAvatar card={card} size="lg" />
          </Link>
          {card.online ? (
            <span className="mb-1 ml-3 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
              <span aria-hidden className="size-1.5 rounded-full bg-green-600" /> Online
            </span>
          ) : null}
        </div>
        <h3 id={`destaque-${card.id}`} className="mt-2 line-clamp-1 text-body font-bold text-neutral-900">
          <Link href={profileHref(card.id)} className="hover:text-purple-700 focus-visible:outline-2 focus-visible:outline-purple-500">
            {card.name}
          </Link>
        </h3>
        <p className="line-clamp-1 text-caption text-neutral-600">{card.position ?? "—"}</p>
        <div className="mt-auto pt-3">
          <Button
            variant={card.following ? "ghost" : "soft"}
            size="sm"
            block
            loading={busy}
            onClick={follow}
            aria-pressed={card.following}
            aria-label={card.following ? `Seguindo ${card.name}. Deixar de seguir` : `Seguir ${card.name}`}
          >
            {card.following ? (
              <>
                <UserCheck aria-hidden /> Seguindo
              </>
            ) : (
              "Seguir"
            )}
          </Button>
        </div>
      </div>
    </article>
  );
}
