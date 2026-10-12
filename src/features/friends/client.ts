"use client";

import { api, ApiError } from "@/lib/api-client";
import type { ChatFile, ChatMessage, ConversationDetail, ConversationSummary, FriendRequests, MessagesPage, PersonCard, PersonProfile, Relation, SharedMedia } from "./types";

/** Chamadas da área "Amigos" à API (mesma origem, cookie de sessão). */

const q = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") search.set(k, String(v));
  const text = search.toString();
  return text ? `?${text}` : "";
};

export const friendsApi = {
  conversations: () => api<{ items: ConversationSummary[] }>("/api/v1/conversations"),
  requests: () => api<FriendRequests>("/api/v1/friends/requests"),
  friends: () => api<{ items: PersonCard[] }>("/api/v1/friends"),
  people: (search: string, limit: number) => api<{ items: PersonCard[]; total: number }>(`/api/v1/friends/people${q({ q: search, limit })}`),
  profile: (userId: string) => api<PersonProfile>(`/api/v1/friends/${userId}/profile`),
  request: (userId: string) => api<{ relation: Relation }>("/api/v1/friends/requests", { method: "POST", body: { userId } }),
  accept: (userId: string) => api<{ relation: Relation }>(`/api/v1/friends/requests/${userId}/accept`, { method: "POST" }),
  dismiss: (userId: string) => api<{ relation: Relation }>(`/api/v1/friends/requests/${userId}`, { method: "DELETE" }),
  unfriend: (userId: string) => api<{ relation: Relation }>(`/api/v1/friends/${userId}`, { method: "DELETE" }),
  open: (body: { kind: "direct"; userId: string } | { kind: "group"; title: string; memberIds: string[] }) => api<{ id: string }>("/api/v1/conversations", { method: "POST", body }),
  detail: (id: string) => api<ConversationDetail>(`/api/v1/conversations/${id}`),
  rename: (id: string, title: string) => api<void>(`/api/v1/conversations/${id}`, { method: "PATCH", body: { title } }),
  addMembers: (id: string, userIds: string[]) => api<void>(`/api/v1/conversations/${id}/members`, { method: "POST", body: { userIds } }),
  removeMember: (id: string, userId: string) => api<void>(`/api/v1/conversations/${id}/members/${userId}`, { method: "DELETE" }),
  messages: (id: string, params: { before?: string; after?: string } = {}) => api<MessagesPage>(`/api/v1/conversations/${id}/messages${q(params)}`),
  send: (id: string, body: { body: string; fileId?: string | null }) => api<ChatMessage>(`/api/v1/conversations/${id}/messages`, { method: "POST", body }),
  deleteMessage: (id: string, messageId: string) => api<void>(`/api/v1/conversations/${id}/messages/${messageId}`, { method: "DELETE" }),
  read: (id: string) => api<void>(`/api/v1/conversations/${id}/read`, { method: "POST" }),
  typing: (id: string) => api<void>(`/api/v1/conversations/${id}/typing`, { method: "POST" }),
  media: (id: string) => api<SharedMedia>(`/api/v1/conversations/${id}/media`),
  presence: () => api<void>("/api/v1/me/presence", { method: "POST" }),

  /** Envia um anexo de conversa (PDF ou imagem até 4 MB) e devolve o arquivo. */
  async upload(file: File): Promise<ChatFile> {
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/v1/files?purpose=chat_attachment", { method: "POST", body: form, credentials: "same-origin" }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (!response?.ok) throw new ApiError(response?.status ?? 0, data?.detail ?? "Não foi possível enviar o arquivo. Tente novamente.");
    return { id: data.id, url: data.url, name: file.name, mimeType: data.mimeType, sizeBytes: data.sizeBytes };
  },
};

export const errorMessage = (error: unknown) => (error instanceof ApiError ? error.message : "Algo deu errado. Tente novamente.");

/** Tamanho legível: 2,4 MB. */
export function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}
