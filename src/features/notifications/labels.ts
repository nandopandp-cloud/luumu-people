import { AtSign, BarChart3, CalendarClock, Heart, Megaphone, MessageSquare, UserPlus, type LucideIcon } from "lucide-react";

export type NotificationCategory = "surveys" | "reminders" | "announcements" | "mentions" | "comments" | "likes" | "friends";

/** Ícone e cores de cada categoria (fundo claro + ícone no tom escuro, contraste AA). */
export const CATEGORY: Record<NotificationCategory, { label: string; icon: LucideIcon; tile: string; filled?: boolean }> = {
  surveys: { label: "Pesquisas", icon: BarChart3, tile: "bg-purple-100 text-purple-600" },
  announcements: { label: "Comunicados", icon: Megaphone, tile: "bg-green-100 text-green-700" },
  mentions: { label: "Menções", icon: AtSign, tile: "bg-purple-100 text-purple-600" },
  comments: { label: "Comentários", icon: MessageSquare, tile: "bg-blue-100 text-blue-700" },
  likes: { label: "Curtidas e reações", icon: Heart, tile: "bg-pink-100 text-red-500", filled: true },
  friends: { label: "Conexões", icon: UserPlus, tile: "bg-yellow-100 text-yellow-800" },
  reminders: { label: "Lembretes", icon: CalendarClock, tile: "bg-orange-100 text-orange-700" },
};

/** Ordem das categorias nos filtros e nas preferências. */
export const CATEGORY_ORDER: NotificationCategory[] = ["surveys", "announcements", "mentions", "comments", "likes", "friends", "reminders"];

export const TABS = [
  { value: "todas", label: "Todas" },
  { value: "nao-lidas", label: "Não lidas" },
  { value: "mencoes", label: "Menções" },
] as const;
export type Tab = (typeof TABS)[number]["value"];

/** Item como chega da API/serviço (datas já serializadas). */
export type NotificationItem = {
  key: string;
  category: NotificationCategory;
  title: string;
  lead: string | null;
  body: string;
  context: string;
  ago: string;
  agoShort: string;
  unread: boolean;
  href: string;
  action: string;
  primary: boolean;
  actors: { name: string; image: string | null }[];
  thumbnail: { coverFileId: string } | { survey: true } | null;
};

/** Evento da página: o sino recarrega o contador quando algo é marcado. */
export const NOTIFICATIONS_CHANGED = "luumu:notifications-changed";

/** Marca como lida/não lida (com keepalive: segue mesmo se a página navegar). */
export async function sendRead(keys: string[], read = true) {
  const response = await fetch("/api/v1/me/notifications/read", {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ keys, read }),
  }).catch(() => null);
  if (response?.ok) window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  return response;
}
