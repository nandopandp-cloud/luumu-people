"use client";

import { Award, Bell, BookOpen, CalendarClock, ClipboardCheck, Megaphone, type LucideIcon } from "lucide-react";
import { Popover } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "../cn";

/**
 * Central de notificações — sino com contador e lista. A fonte de dados
 * (notificações in-app) chega na Fase 2; o componente já é final.
 */
export type NotificationKind = "course" | "path" | "survey" | "announcement" | "achievement" | "deadline";
export type NotificationItem = { id: string; kind: NotificationKind; title: string; description?: string; time: string; unread?: boolean; href?: string };

const KIND: Record<NotificationKind, { icon: LucideIcon; tone: string }> = {
  course: { icon: BookOpen, tone: "bg-purple-100 text-purple-600" },
  path: { icon: BookOpen, tone: "bg-green-100 text-green-700" },
  survey: { icon: ClipboardCheck, tone: "bg-blue-100 text-blue-700" },
  announcement: { icon: Megaphone, tone: "bg-pink-100 text-pink-700" },
  achievement: { icon: Award, tone: "bg-orange-100 text-orange-700" },
  deadline: { icon: CalendarClock, tone: "bg-red-100 text-red-700" },
};

export function NotificationList({ items, empty }: { items: NotificationItem[]; empty?: ReactNode }) {
  if (items.length === 0) return <p className="px-4 py-8 text-center text-body-sm text-neutral-500">{empty ?? "Você está em dia! Nenhuma notificação por aqui."}</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((n) => {
        const { icon: Icon, tone } = KIND[n.kind];
        const content = (
          <>
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", tone)}>
              <Icon aria-hidden className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-body-sm text-neutral-900", n.unread && "font-semibold")}>{n.title}</span>
              {n.description ? <span className="block text-caption text-neutral-600">{n.description}</span> : null}
              <span className="mt-0.5 block text-caption text-neutral-500">{n.time}</span>
            </span>
            {n.unread ? (
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-purple-500">
                <span className="sr-only">Não lida</span>
              </span>
            ) : null}
          </>
        );
        return (
          <li key={n.id}>
            {n.href ? (
              <a href={n.href} className="flex items-start gap-3 px-4 py-3 hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-500">
                {content}
              </a>
            ) : (
              <div className="flex items-start gap-3 px-4 py-3">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function NotificationBell({ items, onMarkAllRead }: { items: NotificationItem[]; onMarkAllRead?: () => void }) {
  const unread = items.filter((n) => n.unread).length;
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={unread ? `Notificações, ${unread} não ${unread === 1 ? "lida" : "lidas"}` : "Notificações"}
        className="relative flex size-12 items-center justify-center rounded-full border border-line bg-white text-neutral-700 shadow-sm transition-colors hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500"
      >
        <Bell aria-hidden className="size-5" />
        {unread ? (
          <span aria-hidden className="absolute right-2.5 top-2.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-white shadow-lg" aria-label="Notificações">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-body-sm font-semibold text-neutral-900">Notificações</p>
            {unread && onMarkAllRead ? (
              <button type="button" onClick={onMarkAllRead} className="text-caption font-medium text-purple-600 hover:underline">
                Marcar todas como lidas
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            <NotificationList items={items} />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
