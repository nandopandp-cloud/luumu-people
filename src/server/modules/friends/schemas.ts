import { z } from "zod";
import { GROUP_TITLE_MAX, MESSAGE_MAX } from "@/server/db/schema/social";

/** Limite de pessoas num grupo (incluindo quem criou). */
export const GROUP_MAX_MEMBERS = 50;

export const userParamsSchema = z.strictObject({ userId: z.uuid() });
export const conversationParamsSchema = z.strictObject({ id: z.uuid() });
export const memberParamsSchema = z.strictObject({ id: z.uuid(), userId: z.uuid() });
export const messageParamsSchema = z.strictObject({ id: z.uuid(), messageId: z.uuid() });

export const peopleQuerySchema = z.strictObject({
  q: z.string().trim().max(80).optional().default(""),
  limit: z.coerce.number().int().min(1).max(60).optional().default(24),
});
export type ColleagueQuery = z.infer<typeof peopleQuerySchema>;

export const friendRequestSchema = z.strictObject({ userId: z.uuid() });

const groupTitle = z.string().trim().min(1, "Dê um nome ao grupo.").max(GROUP_TITLE_MAX, `Use no máximo ${GROUP_TITLE_MAX} caracteres.`);
const memberIds = z
  .array(z.uuid())
  .min(1, "Escolha ao menos uma pessoa.")
  .max(GROUP_MAX_MEMBERS - 1, `Um grupo tem no máximo ${GROUP_MAX_MEMBERS} pessoas.`)
  .transform((ids) => [...new Set(ids)]);

/** Nova conversa: privada (com um amigo) ou em grupo (com amigos). */
export const newConversationSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("direct"), userId: z.uuid() }),
  z.strictObject({ kind: z.literal("group"), title: groupTitle, memberIds }),
]);
export type NewConversation = z.infer<typeof newConversationSchema>;

export const renameGroupSchema = z.strictObject({ title: groupTitle });
export const addMembersSchema = z.strictObject({ userIds: memberIds });

export const messagesQuerySchema = z.strictObject({
  /** Mensagens anteriores a este instante (rolar para cima). */
  before: z.iso.datetime({ offset: true }).optional(),
  /** Novidades desde este instante (atualização periódica). */
  after: z.iso.datetime({ offset: true }).optional(),
});
export type MessagesQuery = z.infer<typeof messagesQuerySchema>;

export const sendMessageSchema = z
  .strictObject({
    body: z.string().max(MESSAGE_MAX, `Use no máximo ${MESSAGE_MAX} caracteres.`).optional().default(""),
    fileId: z.uuid().nullish(),
  })
  .refine((v) => v.body.trim().length > 0 || v.fileId, { message: "Escreva uma mensagem ou anexe um arquivo.", path: ["body"] });
export type SendMessage = z.infer<typeof sendMessageSchema>;
