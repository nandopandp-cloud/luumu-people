/**
 * Formatos da área "Amigos" como chegam da API e das páginas (datas em ISO).
 * Compartilhados entre os serviços (src/server/modules/friends) e a interface.
 */

/** Relação da pessoa atual com outra: nenhuma, amigos, pedido enviado, pedido recebido. */
export type Relation = "none" | "friends" | "sent" | "received";

export type MoodView = { mood: number; note: string | null; at: string };

export type PersonLite = { id: string; name: string; image: string | null };

/** Cartão de colega: só dados profissionais públicos na empresa (sem e-mail, telefone ou dados de RH). */
export type PersonCard = PersonLite & {
  position: string | null;
  orgUnit: string | null;
  location: string | null;
  relation: Relation;
  mutualCount: number;
  /** Só para amigos e para quem conversa com a pessoa. */
  online: boolean;
  mood: MoodView | null;
};

/** Cartão de Conexões: o cartão de colega com afinidades e capa. */
export type ConnectionCard = PersonCard & {
  /** Chaves de interesses em comum (src/lib/interests.ts). */
  commonInterests: string[];
  /** Mesmo time: mesma área, mesmo gestor, ou gestor/liderado direto. */
  sameTeam: boolean;
  cover: string | null;
};

export type DiscoverFilter = "todos" | "equipe" | "departamento" | "interesses" | "conexoes";

export type ConnectionsCounts = { friends: number; received: number; sent: number; online: number };

export type FriendRequest = { person: PersonCard; at: string };
export type FriendRequests = { received: FriendRequest[]; sent: FriendRequest[] };

export type GroupInCommon = { id: string; title: string; memberCount: number };

/** Perfil exibido no painel lateral e em "Ver perfil". */
export type PersonProfile = PersonCard & {
  headline: string | null;
  cover: string | null;
  mutualFriends: PersonLite[];
  groupsInCommon: GroupInCommon[];
  /** Conversa privada já existente com a pessoa. */
  directConversationId: string | null;
  /** Interesses do perfil e os em comum com a pessoa atual (chaves do catálogo). */
  interests: string[];
  commonInterests: string[];
};

export type ConversationKind = "direct" | "group";

export type LastMessage = { preview: string; senderName: string; mine: boolean; at: string; hasFile: boolean; deleted: boolean };

export type ConversationSummary = {
  id: string;
  kind: ConversationKind;
  /** Nome do grupo ou da outra pessoa. */
  title: string;
  image: string | null;
  /** Conversa privada: a outra pessoa (sentimento e presença). */
  other: (PersonLite & { online: boolean; mood: MoodView | null }) | null;
  /** Grupo: alguns participantes (avatares). */
  members: PersonLite[];
  memberCount: number;
  lastMessage: LastMessage | null;
  unread: number;
  /** Última atividade (ordem da lista). */
  activityAt: string;
};

export type ChatFile = { id: string; url: string; name: string; mimeType: string; sizeBytes: number };

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderImage: string | null;
  mine: boolean;
  body: string;
  file: ChatFile | null;
  at: string;
  deleted: boolean;
  /** Texto corrigido depois do envio. */
  edited: boolean;
  likes: number;
  likedByMe: boolean;
  /** Nomes de quem curtiu (ordem das curtidas). */
  likedBy: string[];
};

export type MemberView = PersonLite & { role: "admin" | "member"; position: string | null; online: boolean; mood: MoodView | null };

export type ConversationDetail = {
  id: string;
  kind: ConversationKind;
  title: string;
  myRole: "admin" | "member";
  members: MemberView[];
  /** Conversa privada: id da outra pessoa. */
  otherId: string | null;
  /** Motivo quando não é possível enviar (ex.: deixaram de ser amigos). */
  blocked: string | null;
};

export type MessagesPage = {
  items: ChatMessage[];
  hasMore: boolean;
  /** Até quando TODAS as outras pessoas leram (para o ✓✓). */
  othersReadAt: string | null;
  typing: string[];
  online: string[];
  serverTime: string;
};

export type SharedMedia = {
  images: (ChatFile & { at: string })[];
  files: (ChatFile & { at: string })[];
  links: { url: string; at: string; messageId: string }[];
};
