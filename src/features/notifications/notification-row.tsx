"use client";

import { ArrowRight, BellOff, CalendarDays, Check, ClipboardCheck, FileText, MoreVertical, Undo2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Mascot } from "@/design-system/components/brand";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/design-system/components/menu";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { api } from "@/lib/api-client";
import { CATEGORY, sendRead, type NotificationCategory, type NotificationItem } from "./labels";

export function CategoryTile({ category, className, iconClassName }: { category: NotificationCategory; className?: string; iconClassName?: string }) {
  const { icon: Icon, tile, filled } = CATEGORY[category];
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-xl", tile, className)}>
      <Icon className={cn("size-6", filled && "fill-current", iconClassName)} />
    </span>
  );
}

/** Bolinha de estado: cheia = não lida; vazada = lida (o estado também vai em texto). */
export function ReadDot({ unread }: { unread: boolean }) {
  return (
    <span className={cn("mt-2 size-2 shrink-0 rounded-full", unread ? "bg-purple-500" : "border-[1.5px] border-neutral-400")}>
      <span className="sr-only">{unread ? "Não lida." : "Lida."}</span>
    </span>
  );
}

function Thumbnail({ thumbnail }: { thumbnail: NotificationItem["thumbnail"] }) {
  if (!thumbnail) return null;
  const frame = "hidden h-[72px] w-36 shrink-0 overflow-hidden rounded-lg md:block";
  if ("coverFileId" in thumbnail) {
    // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API
    return <img src={`/api/v1/files/${thumbnail.coverFileId}`} alt="" className={cn(frame, "object-cover")} />;
  }
  return (
    <span aria-hidden className={cn(frame, "relative bg-gradient-to-br from-purple-50 via-purple-100 to-purple-200")}>
      <span className="absolute left-3 top-3 flex size-11 -rotate-6 items-center justify-center rounded-md bg-white text-purple-500 shadow-md">
        <ClipboardCheck className="size-6" />
      </span>
      <Mascot className="absolute -bottom-2 right-2 h-16" />
    </span>
  );
}

function Actors({ actors }: { actors: NotificationItem["actors"] }) {
  if (actors.length === 0) return null;
  return (
    <span aria-hidden className="flex shrink-0 -space-x-2.5">
      {actors.map((a) => (
        <Avatar key={a.name} name={a.name} src={a.image} size="md" />
      ))}
    </span>
  );
}

/** Notificação na central: ícone, estado, texto, contexto, tempo, ação e menu. */
export function NotificationRow({ item, muted }: { item: NotificationItem; muted: NotificationCategory[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function toggleRead() {
    startTransition(async () => {
      await sendRead([item.key], item.unread);
      router.refresh();
    });
  }

  function mute() {
    startTransition(async () => {
      try {
        await api("/api/v1/me/notifications/preferences", { method: "PUT", body: { muted: [...new Set([...muted, item.category])] } });
        toast({ tone: "success", title: `${CATEGORY[item.category].label}: notificações desativadas`, description: "Você pode reativar em Preferências de notificação." });
        router.refresh();
      } catch {
        toast({ tone: "error", title: "Não foi possível salvar a preferência." });
      }
    });
  }

  return (
    <article
      aria-label={`${item.title}${item.unread ? " (não lida)" : ""}`}
      className={cn("flex gap-3 rounded-xl p-4 transition-colors sm:gap-4 sm:p-5", item.unread ? "bg-purple-50/80" : "bg-white", pending && "opacity-70")}
    >
      <CategoryTile category={item.category} className="size-12 sm:size-14" />
      <ReadDot unread={item.unread} />
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-neutral-900">{item.title}</h3>
        <div className="mt-1 flex items-start gap-3">
          <Actors actors={item.actors} />
          <p className="min-w-0 text-body-sm text-neutral-700">
            {item.lead ? <strong className="font-semibold text-neutral-900">{item.lead} </strong> : null}
            {item.body}
          </p>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-caption text-neutral-600">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <FileText aria-hidden className="size-4 shrink-0" />
            <span className="truncate">{item.context}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden className="size-4 shrink-0" />
            {item.ago}
          </span>
        </p>
        {/* Ação no celular: abaixo do texto. */}
        <ActionLink item={item} className="mt-3 sm:hidden" />
      </div>
      <Thumbnail thumbnail={item.thumbnail} />
      <div className="flex shrink-0 items-start gap-1 self-center">
        <ActionLink item={item} className="hidden sm:inline-flex" />
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label={`Mais opções: ${item.title}`}
              className="inline-flex size-9 items-center justify-center rounded-full text-neutral-700 hover:bg-white hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500 sm:self-start"
            >
              <MoreVertical aria-hidden className="size-5" />
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={toggleRead}>
              {item.unread ? (
                <>
                  <Check aria-hidden /> Marcar como lida
                </>
              ) : (
                <>
                  <Undo2 aria-hidden /> Marcar como não lida
                </>
              )}
            </MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={mute}>
              <BellOff aria-hidden /> Desativar notificações de {CATEGORY[item.category].label.toLowerCase()}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </article>
  );
}

function ActionLink({ item, className }: { item: NotificationItem; className?: string }) {
  return (
    <Link
      href={item.href as Route}
      onClick={() => {
        if (item.unread) void sendRead([item.key]);
      }}
      className={cn(
        "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-5 text-body-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
        item.primary ? "bg-purple-500 text-white shadow-sm hover:bg-purple-600" : "border border-line bg-white text-purple-600 hover:border-purple-300 hover:bg-purple-50",
        className,
      )}
    >
      {item.action} <ArrowRight aria-hidden className="size-4" />
      <span className="sr-only">: {item.context}</span>
    </Link>
  );
}
