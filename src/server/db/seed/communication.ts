import { and, eq } from "drizzle-orm";
import type { Database } from "../client";
import * as s from "../schema";

/**
 * Dados de EXEMPLO do mural de comunicados: agenda de eventos, links rápidos,
 * um comunicado para uma área, curtidas, comentários e um vídeo anexado.
 * Idempotente por tenant (não duplica se já houver eventos).
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Dia `n` a partir de hoje, no horário (de Brasília) informado. */
const at = (n: number, hour: number) => {
  const d = new Date(Date.now() + n * DAY);
  d.setUTCHours(hour + 3, 0, 0, 0);
  return d;
};

const EVENTS: { title: string; description: string; kind: (typeof s.EVENT_KINDS)[number]; mode: (typeof s.EVENT_MODES)[number]; location?: string; url?: string; inDays: number; hour: number; hours: number; published?: boolean }[] = [
  {
    title: "Roda de conversa: Saúde Mental",
    description: "Um espaço seguro para falar sobre autocuidado, limites e pedidos de ajuda, com a psicóloga do programa de bem-estar.",
    kind: "evento",
    mode: "online",
    url: "https://meet.aurora.example/saude-mental",
    inDays: 4,
    hour: 10,
    hours: 1,
  },
  {
    title: "Workshop de Produtividade",
    description: "Técnicas práticas para organizar prioridades, proteger o foco e reduzir reuniões desnecessárias.",
    kind: "treinamento",
    mode: "presencial",
    location: "Sede",
    inDays: 6,
    hour: 14,
    hours: 2,
  },
  {
    title: "Café com o Time de Produto",
    description: "Conversa aberta com o time de Produto sobre o que vem por aí no próximo trimestre.",
    kind: "evento",
    mode: "online",
    url: "https://meet.aurora.example/cafe-produto",
    inDays: 11,
    hour: 10,
    hours: 1,
  },
  {
    title: "Palestra: Liderança Inclusiva",
    description: "Convidada externa fala sobre práticas de liderança que acolhem a diversidade.",
    kind: "palestra",
    mode: "hibrido",
    location: "Auditório da sede",
    url: "https://meet.aurora.example/lideranca-inclusiva",
    inDays: 18,
    hour: 16,
    hours: 1,
  },
  { title: "Integração de novas pessoas (rascunho)", description: "Programação em definição.", kind: "evento", mode: "online", inDays: 25, hour: 9, hours: 3, published: false },
];

const QUICK_LINKS: { label: string; url: string; icon: (typeof s.QUICK_LINK_ICONS)[number]; color: (typeof s.QUICK_LINK_COLORS)[number] }[] = [
  { label: "Benefícios", url: "https://beneficios.aurora.example", icon: "gift", color: "purple" },
  { label: "Políticas", url: "https://intranet.aurora.example/politicas", icon: "file", color: "blue" },
  { label: "Canais de Ajuda", url: "https://ajuda.aurora.example", icon: "headset", color: "green" },
  { label: "Calendário", url: "/comunicados/eventos", icon: "calendar", color: "orange" },
];

const COMMENTS: { announcement: string; author: string; body: string }[] = [
  { announcement: "Nova política de trabalho híbrido", author: "camila.oliveira", body: "Ótima notícia! Os dias presenciais vão ser combinados por time ou por área?" },
  { announcement: "Nova política de trabalho híbrido", author: "gabriel.rocha", body: "Adorei a janela de colaboração das 10h às 16h." },
  { announcement: "Semana da Diversidade", author: "camila.oliveira", body: "Vou participar da roda de conversa de terça!" },
  { announcement: "Programa de Saúde Mental", author: "gabriel.rocha", body: "Muito importante. Obrigado por cuidarem da gente." },
];

export async function seedCommunication(db: Database, tenantId: string): Promise<boolean> {
  const existing = await db.select({ id: s.events.id }).from(s.events).where(eq(s.events.tenantId, tenantId)).limit(1);
  if (existing.length > 0) return false;

  await db.insert(s.events).values(
    EVENTS.map((e) => {
      const startsAt = at(e.inDays, e.hour);
      return {
        tenantId,
        title: e.title,
        description: e.description,
        kind: e.kind,
        mode: e.mode,
        location: e.location ?? null,
        url: e.url ?? null,
        startsAt,
        endsAt: new Date(startsAt.getTime() + e.hours * HOUR),
        published: e.published ?? true,
      };
    }),
  );
  await db.insert(s.quickLinks).values(QUICK_LINKS.map((l, position) => ({ tenantId, ...l, position })));

  const announcements = await db
    .select({ id: s.announcements.id, title: s.announcements.title, status: s.announcements.status })
    .from(s.announcements)
    .where(eq(s.announcements.tenantId, tenantId));
  const byTitle = new Map(announcements.map((a) => [a.title, a.id]));

  // Segundo destaque do carrossel do mural.
  const diversity = byTitle.get("Semana da Diversidade");
  if (diversity) await db.update(s.announcements).set({ pinned: true }).where(eq(s.announcements.id, diversity));

  // Comunicado só para a área de Produto (e subáreas).
  const [produto] = await db.select({ id: s.orgUnits.id }).from(s.orgUnits).where(and(eq(s.orgUnits.tenantId, tenantId), eq(s.orgUnits.code, "prod")));
  if (produto) {
    await db.insert(s.announcements).values({
      tenantId,
      title: "Planejamento do trimestre de Produto",
      summary: "Agenda das cerimônias de planejamento e o que cada time precisa preparar.",
      body: "Na próxima semana fazemos o planejamento do trimestre. Cada time traz os resultados do ciclo anterior e uma proposta de prioridades.\n\nA agenda detalhada está no calendário compartilhado de Produto.",
      category: "institucional",
      theme: "blue",
      illustration: "target",
      status: "published",
      publishedAt: new Date(Date.now() - 3 * HOUR),
      audienceOrgUnitId: produto.id,
    });
  }

  const people = await db
    .select({ id: s.users.id, email: s.users.email })
    .from(s.users)
    .where(and(eq(s.users.tenantId, tenantId), eq(s.users.status, "active")));
  const userByKey = new Map(people.map((p) => [p.email.split("@")[0]!, p.id]));

  // Curtidas determinísticas: cada comunicado publicado recebe uma fatia diferente das pessoas.
  const published = announcements.filter((a) => a.status === "published");
  const reactions = published.flatMap((a, i) => people.filter((_, j) => (j + i) % (i + 2) === 0).map((p) => ({ tenantId, announcementId: a.id, userId: p.id })));
  if (reactions.length) await db.insert(s.announcementReactions).values(reactions);

  const comments = COMMENTS.flatMap((c) => {
    const announcementId = byTitle.get(c.announcement);
    const authorId = userByKey.get(c.author);
    return announcementId && authorId ? [{ tenantId, announcementId, authorId, body: c.body }] : [];
  });
  if (comments.length) await db.insert(s.announcementComments).values(comments);

  if (diversity) {
    await db.insert(s.announcementAttachments).values({ tenantId, announcementId: diversity, kind: "video", title: "Convite da Semana da Diversidade", videoUrl: "https://vimeo.com/76979871" });
  }
  return true;
}

