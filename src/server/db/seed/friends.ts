import type { Database } from "../client";
import * as s from "../schema";

/**
 * Dados de EXEMPLO da área "Amigos" (somente desenvolvimento e testes):
 * amizades do Fernando e de colegas (para "amigos em comum"), dois pedidos
 * recebidos, um enviado e as conversas da referência — privadas e em grupo.
 */

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** Hoje às hh:mm (horário de Brasília), ou `daysAgo` dias atrás. */
function at(hhmm: string, daysAgo = 0) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(Date.now() - daysAgo * DAY);
  d.setUTCHours(h! + 3, m!, 0, 0);
  return d;
}

/** Seed rodando antes do horário das mensagens "de hoje": recua a conversa inteira para o passado. */
function inThePast(messages: Msg[]): Msg[] {
  const latest = Date.now() - 2 * MINUTE;
  const shift = Math.max(0, messages.at(-1)!.at.getTime() - latest);
  return messages.map((m) => ({ ...m, at: new Date(m.at.getTime() - shift) }));
}

const FRIENDS: [string, string][] = [
  ...["carla", "rafael", "juliana", "lucas", "bruno", "camila", "gabriel", "helena", "larissa", "pedro"].map((k) => ["fernando", k] as [string, string]),
  ["carla", "rafael"],
  ["carla", "juliana"],
  ["carla", "camila"],
  ["carla", "lucas"],
  ["carla", "helena"],
  ["carla", "larissa"],
  ["rafael", "larissa"],
  ["rafael", "pedro"],
  ["juliana", "camila"],
  ["lucas", "gabriel"],
];

/** Pedidos pendentes: [quem pede, quem recebe]. */
const PENDING: [string, string][] = [
  ["amanda", "fernando"],
  ["diego", "fernando"],
  ["fernando", "thiago"],
];

type Msg = { from: string; body: string; at: Date };
type ConversationSeed = { kind: "direct" | "group"; title?: string; members: string[]; messages: Msg[]; readUpTo?: Record<string, number> };

function conversations(): ConversationSeed[] {
  return [
    {
      kind: "direct",
      members: ["fernando", "carla"],
      messages: [
        { from: "carla", body: "Oi, Fernando!\nTudo bem?", at: at("10:20") },
        { from: "fernando", body: "Oi, Carla! Tudo bem sim e você?", at: at("10:21") },
        { from: "carla", body: "Aqui está tudo ótimo!\nVocê viu o novo curso de liderança que lançaram na plataforma?", at: at("10:22") },
        { from: "fernando", body: "Vi sim! Achei incrível, já me inscrevi!\nVamos fazer juntos?", at: at("10:23") },
        { from: "carla", body: "Show! Vamos sim! 💜", at: at("10:24") },
      ],
      // O Fernando leu até a 3ª mensagem; a Carla leu tudo.
      readUpTo: { fernando: 3, carla: 5 },
    },
    {
      kind: "direct",
      members: ["fernando", "rafael"],
      messages: [
        { from: "fernando", body: "Rafa, consegue me mandar o guia de marca atualizado?", at: at("09:10") },
        { from: "rafael", body: "Te mando o material aqui", at: at("09:18") },
      ],
      readUpTo: { fernando: 1, rafael: 2 },
    },
    {
      kind: "direct",
      members: ["fernando", "juliana"],
      messages: [
        { from: "fernando", body: "Juliana, a trilha de onboarding já está liberada para o time novo.", at: at("16:40", 1) },
        { from: "juliana", body: "Perfeito! Obrigada 🙏", at: at("16:52", 1) },
      ],
    },
    {
      kind: "group",
      title: "Time Produto",
      members: ["fernando", "carla", "camila", "gabriel", "lucas", "helena"],
      messages: [
        { from: "carla", body: "Pessoal, planejamento do trimestre na quinta às 10h.", at: at("11:02", 1) },
        { from: "gabriel", body: "Fechado! Levo os números de ativação.", at: at("11:15", 1) },
        { from: "camila", body: "Vou compartilhar a pauta aqui até amanhã.", at: at("11:30", 1) },
      ],
    },
    {
      kind: "direct",
      members: ["fernando", "lucas"],
      messages: [
        { from: "fernando", body: "Lucas, deixei os comentários no documento da discovery.", at: at("17:20", 3) },
        { from: "lucas", body: "Valeu!", at: at("17:31", 3) },
      ],
    },
    {
      kind: "group",
      title: "Designers Luumu",
      members: ["rafael", "fernando", "larissa", "pedro"],
      messages: [
        { from: "larissa", body: "Atualizei os componentes de formulário na biblioteca.", at: at("14:05", 4) },
        { from: "pedro", body: "Nova arte no Figma", at: at("15:40", 4) },
      ],
    },
    {
      kind: "direct",
      members: ["fernando", "bruno"],
      messages: [
        { from: "fernando", body: "Bruno, o ajuste da API de relatórios entrou na sprint?", at: at("10:00", 5) },
        { from: "bruno", body: "Show! Vou dar uma olhada", at: at("10:12", 5) },
      ],
    },
  ];
}

/** Interesses do perfil (catálogo em src/lib/interests.ts). */
const INTERESTS_BY_PERSON: Record<string, string[]> = {
  fernando: ["produto", "design", "dados", "leitura", "cafe", "viagens"],
  carla: ["produto", "lideranca", "design", "leitura", "viagens", "corrida"],
  camila: ["produto", "dados", "cafe", "musica", "viagens"],
  gabriel: ["dados", "games", "tecnologia", "cafe"],
  lucas: ["produto", "tecnologia", "ciclismo", "fotografia"],
  helena: ["produto", "design", "leitura", "pets"],
  rafael: ["design", "fotografia", "musica", "cafe", "cinema"],
  larissa: ["design", "fotografia", "viagens", "leitura", "pets"],
  pedro: ["tecnologia", "design", "games", "musica"],
  bruno: ["tecnologia", "dados", "corrida", "cafe"],
  isabela: ["tecnologia", "idiomas", "viagens", "leitura"],
  diego: ["tecnologia", "games", "cinema"],
  amanda: ["tecnologia", "design", "produto", "bem-estar", "viagens"],
  vinicius: ["tecnologia", "ciclismo", "natureza"],
  renata: ["dados", "lideranca", "leitura", "cafe"],
  felipe: ["dados", "tecnologia", "esportes"],
  juliana: ["educacao", "comunicacao", "leitura", "bem-estar", "viagens", "cafe"],
  eduardo: ["educacao", "lideranca", "esportes"],
  roberta: ["educacao", "escrita", "leitura", "voluntariado"],
  paula: ["tecnologia", "dados", "culinaria"],
  patricia: ["lideranca", "comunicacao", "voluntariado", "bem-estar"],
  marcos: ["esportes", "culinaria", "pets"],
  tatiane: ["comunicacao", "musica", "cinema"],
  thiago: ["lideranca", "tecnologia", "corrida", "cafe"],
  joao: ["comunicacao", "esportes", "viagens"],
  natalia: ["comunicacao", "idiomas", "fotografia"],
  daniela: ["lideranca", "comunicacao", "bem-estar"],
  leonardo: ["comunicacao", "games", "natureza"],
  luiza: ["escrita", "leitura", "idiomas"],
  simone: ["dados", "culinaria", "natureza"],
};

/** Quem segue quem: [seguidor, seguido]. */
const FOLLOWS: [string, string][] = [
  ["carla", "fernando"],
  ["juliana", "fernando"],
  ["camila", "fernando"],
  ["fernando", "rafael"],
  ["fernando", "renata"],
  ["larissa", "rafael"],
  ["pedro", "rafael"],
  ["gabriel", "carla"],
  ["helena", "carla"],
  ["roberta", "juliana"],
];

export async function seedFriends(db: Database, tenantId: string, users: Map<string, { id: string }>) {
  const id = (key: string) => users.get(key)?.id;
  const pair = ([a, b]: [string, string]) => [id(a), id(b)] as const;
  const accepted = FRIENDS.map(pair).filter((p): p is readonly [string, string] => Boolean(p[0] && p[1]));
  if (accepted.length === 0) return;

  await db.insert(s.friendships).values(accepted.map(([requesterId, addresseeId]) => ({ tenantId, requesterId, addresseeId, status: "accepted" as const, createdAt: new Date(Date.now() - 40 * DAY), respondedAt: new Date(Date.now() - 39 * DAY) })));
  const pending = PENDING.map(pair).filter((p): p is readonly [string, string] => Boolean(p[0] && p[1]));
  if (pending.length) await db.insert(s.friendships).values(pending.map(([requesterId, addresseeId], i) => ({ tenantId, requesterId, addresseeId, createdAt: new Date(Date.now() - (i + 1) * 3 * 60 * MINUTE) })));

  const interests = Object.entries(INTERESTS_BY_PERSON).flatMap(([key, list]) => (id(key) ? list.map((interestKey) => ({ tenantId, userId: id(key)!, interestKey })) : []));
  if (interests.length) await db.insert(s.userInterests).values(interests);
  const follows = FOLLOWS.map(pair).filter((p): p is readonly [string, string] => Boolean(p[0] && p[1]));
  if (follows.length) await db.insert(s.userFollows).values(follows.map(([followerId, followeeId], i) => ({ tenantId, followerId, followeeId, createdAt: new Date(Date.now() - (i + 1) * 5 * 60 * MINUTE) })));

  const joinedAt = new Date(Date.now() - 30 * DAY);
  for (const c of conversations().map((c) => ({ ...c, messages: inThePast(c.messages) }))) {
    const members = c.members.map(id);
    if (members.some((m) => !m)) continue;
    const ids = members as string[];
    const sorted = [...ids].sort();
    const [conversation] = await db
      .insert(s.conversations)
      .values({ tenantId, kind: c.kind, title: c.title ?? null, directKey: c.kind === "direct" ? `${sorted[0]}:${sorted[1]}` : null, createdBy: ids[0]!, createdAt: joinedAt })
      .returning({ id: s.conversations.id });
    const messages = c.messages.map((m) => ({ tenantId, conversationId: conversation!.id, senderId: id(m.from)!, body: m.body, createdAt: m.at }));
    await db.insert(s.chatMessages).values(messages);
    const last = c.messages.at(-1)!.at;
    await db.insert(s.conversationMembers).values(
      c.members.map((key, i) => {
        const upTo = c.readUpTo?.[key];
        const lastReadAt = upTo === undefined ? last : upTo === 0 ? null : c.messages[upTo - 1]!.at;
        return { tenantId, conversationId: conversation!.id, userId: ids[i]!, role: i === 0 ? ("admin" as const) : ("member" as const), joinedAt, lastReadAt };
      }),
    );
  }
}
