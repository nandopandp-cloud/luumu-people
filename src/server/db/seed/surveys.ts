import { and, eq, sql } from "drizzle-orm";
import { approveDimensions, dimensionProfiles, generalizedDimensions } from "@/server/modules/surveys/dimensions";
import type { Database } from "../client";
import * as s from "../schema";
import type { QuestionType, SurveyKind } from "../schema/surveys";

/**
 * Pesquisas de EXEMPLO (somente desenvolvimento e testes): uma de clima em
 * andamento, um eNPS encerrado e um rascunho. As respostas demonstrativas
 * passam pelo MESMO caminho do produto: survey_vault.submit (buffer → lotes
 * embaralhados), sem nenhum vínculo com quem "respondeu".
 */

const DAY = 24 * 60 * 60 * 1000;

type QuestionSeed = { type: QuestionType; text: string; options?: string[]; required?: boolean };
type SurveySeed = { title: string; description: string; kind: SurveyKind; questions: QuestionSeed[] };

const CLIMATE: SurveySeed = {
  title: "Pesquisa de Clima 2026",
  description: "Queremos ouvir você sobre o dia a dia, a liderança e o ambiente de trabalho. Leva cerca de 5 minutos.",
  kind: "climate",
  questions: [
    { type: "scale", text: "Tenho clareza sobre o que se espera do meu trabalho." },
    { type: "scale", text: "Minha liderança me dá feedbacks que me ajudam a crescer." },
    { type: "scale", text: "Sinto que posso ser eu mesmo(a) no trabalho." },
    { type: "scale", text: "Tenho as ferramentas e os recursos de que preciso." },
    { type: "scale", text: "Consigo equilibrar trabalho e vida pessoal." },
    { type: "enps", text: "Em uma escala de 0 a 10, o quanto você recomendaria a empresa como um bom lugar para trabalhar?" },
    { type: "choice", text: "O que mais contribui para o seu bem-estar aqui?", options: ["Pessoas e clima", "Aprendizado", "Flexibilidade", "Benefícios", "Propósito"] },
    { type: "text", text: "O que podemos fazer para melhorar a sua experiência?", required: false },
  ],
};

const ENPS: SurveySeed = {
  title: "eNPS — 1º semestre de 2026",
  description: "Pesquisa rápida de recomendação.",
  kind: "enps",
  questions: [
    { type: "enps", text: "Em uma escala de 0 a 10, o quanto você recomendaria a empresa como um bom lugar para trabalhar?" },
    { type: "scale", text: "Sinto que meu trabalho é reconhecido." },
    { type: "text", text: "Quer contar o motivo da sua nota?", required: false },
  ],
};

const PULSE_DRAFT: SurveySeed = {
  title: "Pulso de bem-estar",
  description: "Três perguntas rápidas sobre energia e carga de trabalho.",
  kind: "pulse",
  questions: [
    { type: "scale", text: "Minha carga de trabalho está adequada." },
    { type: "scale", text: "Tenho energia para as minhas atividades da semana." },
    { type: "text", text: "Algo mais que queira compartilhar?", required: false },
  ],
};

const COMMENTS = [
  "Mais momentos de integração entre as áreas.",
  "Gostaria de rituais de feedback mais frequentes.",
  "Mais clareza nas prioridades do trimestre.",
  "O programa de aprendizagem tem feito diferença.",
  "Ferramentas internas poderiam ser mais simples.",
  "Reconhecer mais as entregas do time.",
];

/** Pessoas que ficam com convite PENDENTE (usadas nos fluxos de teste e demonstração). */
const KEEP_PENDING = /^(fernando|natalia|camila|carla|paula|juliana|isabela)\./;

/** Gerador determinístico (mulberry32): mesmo seed, mesmas respostas. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function answerFor(q: QuestionSeed, rnd: () => number): number | string | undefined {
  if (q.type === "scale") return Math.min(5, Math.max(1, Math.round(3.6 + (rnd() - 0.4) * 3)));
  if (q.type === "enps") return Math.min(10, Math.max(0, Math.round(7.4 + (rnd() - 0.45) * 6)));
  if (q.type === "choice") return q.options![Math.floor(rnd() * q.options!.length)];
  return rnd() < 0.45 ? COMMENTS[Math.floor(rnd() * COMMENTS.length)] : undefined;
}

async function insertSurvey(db: Database, tenantId: string, seed: SurveySeed, k: number) {
  const [row] = await db.insert(s.surveys).values({ tenantId, title: seed.title, description: seed.description, kind: seed.kind, anonymityK: k }).returning({ id: s.surveys.id });
  const ids = await db
    .insert(s.surveyQuestions)
    .values(seed.questions.map((q, i) => ({ tenantId, surveyId: row!.id, position: i + 1, type: q.type, text: q.text, options: q.options ?? null, required: q.required ?? true })))
    .returning({ id: s.surveyQuestions.id, position: s.surveyQuestions.position });
  return { id: row!.id, questionIds: ids.sort((a, b) => a.position - b.position).map((q) => q.id) };
}

export async function seedSurveys(db: Database, tenantId: string): Promise<void> {
  const existing = await db.select({ id: s.surveys.id }).from(s.surveys).where(eq(s.surveys.tenantId, tenantId)).limit(1);
  if (existing.length > 0) return;
  const [org] = await db.select({ k: s.organizations.anonymityK }).from(s.organizations).where(eq(s.organizations.id, tenantId));
  const k = org?.k ?? 5;

  await insertSurvey(db, tenantId, PULSE_DRAFT, k);

  const profiles = await dimensionProfiles(db, undefined, tenantId);
  if (profiles.length < k * 2) return;
  const emails = new Map(
    (await db.select({ id: s.users.id, email: s.users.email }).from(s.users).where(and(eq(s.users.tenantId, tenantId), eq(s.users.status, "active")))).map((u) => [u.id, u.email]),
  );
  const dimensions = approveDimensions(profiles, k);
  // As funções do cofre validam a pesquisa pelo tenant da "sessão".
  await db.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);

  const plans = [
    { seed: CLIMATE, launchedDaysAgo: 5, closesInDays: 12, share: 0.7, close: false, salt: 7 },
    { seed: ENPS, launchedDaysAgo: 120, closesInDays: 30, share: 0.8, close: true, salt: 11 },
  ];
  for (const plan of plans) {
    const { id, questionIds } = await insertSurvey(db, tenantId, plan.seed, k);
    const launchedAt = new Date(Date.now() - plan.launchedDaysAgo * DAY);
    await db.insert(s.surveyInvitations).values(profiles.map((p) => ({ tenantId, surveyId: id, userId: p.userId })));
    await db
      .update(s.surveys)
      .set({ status: "active", launchedAt, closesAt: new Date(Date.now() + plan.closesInDays * DAY), dimensions })
      .where(eq(s.surveys.id, id));

    const rnd = random(plan.salt);
    for (const [index, profile] of profiles.entries()) {
      if (KEEP_PENDING.test(emails.get(profile.userId) ?? "") || rnd() > plan.share) continue;
      const answers: Record<string, number | string> = {};
      plan.seed.questions.forEach((q, i) => {
        const value = answerFor(q, rnd);
        if (value !== undefined) answers[questionIds[i]!] = value;
      });
      const completedOn = new Date(launchedAt.getTime() + (index % 5) * DAY).toISOString().slice(0, 10);
      await db
        .update(s.surveyInvitations)
        .set({ status: "completed", completedOn })
        .where(and(eq(s.surveyInvitations.surveyId, id), eq(s.surveyInvitations.userId, profile.userId)));
      await db.execute(
        sql`select survey_vault.submit(${id}::uuid, ${JSON.stringify(generalizedDimensions(profile, dimensions))}::jsonb, ${JSON.stringify(answers)}::jsonb)`,
      );
    }

    if (plan.close) {
      const closesAt = new Date(launchedAt.getTime() + 20 * DAY);
      await db.update(s.surveys).set({ status: "closed", closesAt, closedAt: closesAt }).where(eq(s.surveys.id, id));
      await db.execute(sql`select survey_vault.close(${id}::uuid)`);
    }
  }
}
