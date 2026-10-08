import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as completeRoute from "@/app/api/v1/courses/[id]/lessons/[lessonId]/complete/route";
import * as enrollRoute from "@/app/api/v1/courses/[id]/enroll/route";
import { resolveActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { getCourse, getMyCertificate, learningHoursByMonth, listCatalog, listMyCourses } from "@/server/modules/courses/service";
import { headersWith, signIn } from "../support/auth";
import { tenantOf, testDatabase } from "../support/db";
import { call } from "../support/http";

async function courseId(slug: string, title: string) {
  const { db } = await testDatabase();
  const tenant = await tenantOf(slug);
  const [row] = await db.select({ id: s.courses.id }).from(s.courses).where(and(eq(s.courses.tenantId, tenant.tenantId), eq(s.courses.title, title)));
  return row!.id;
}

describe("cursos do colaborador", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("abas de Meus cursos refletem a jornada", async () => {
    const actor = (await resolveActor(headersWith((await signIn("aurora", "fernando")).cookie)))!;
    const { counts, items } = await listMyCourses(actor, "em-andamento");
    expect(counts).toEqual({ "em-andamento": 3, "nao-iniciados": 2, concluidos: 4, obrigatorios: 3 });
    expect(items[0]).toMatchObject({ title: "Comunicação Não Violenta", lessonsDone: 5, lessonsTotal: 6, remainingMinutes: 20, pathTitle: "Comunicação Eficaz" });
  });

  it("concluir todas as aulas leva a 100% e emite certificado", async () => {
    const session = await signIn("aurora", "gabriel");
    const actor = (await resolveActor(headersWith(session.cookie)))!;
    const id = await courseId("aurora", "Comunicação Não Violenta");
    const before = await getCourse(actor, id);
    expect(before.certificate).toBeNull();

    let last: { json: { progress: number; completed: boolean; certificate: string | null } } | undefined;
    for (const lesson of before.lessons.filter((l) => !l.done)) {
      last = await call(completeRoute.POST, { path: `/api/v1/courses/${id}/lessons/${lesson.id}/complete`, method: "POST", cookie: session.cookie, params: { id, lessonId: lesson.id } });
    }
    expect(last!.json).toMatchObject({ progress: 100, completed: true });
    expect(last!.json.certificate).toMatch(/^[A-Z2-9]{10}$/);

    const cert = await getMyCertificate(actor, id);
    expect(cert).toMatchObject({ courseTitle: "Comunicação Não Violenta", personName: "Gabriel Rocha", organization: "Aurora Tecnologia" });

    // Repetir a conclusão não duplica nada nem muda o código.
    const again = await call(completeRoute.POST, { path: "/x", method: "POST", cookie: session.cookie, params: { id, lessonId: before.lessons[0]!.id } });
    expect(again.json.certificate).toBe(last!.json.certificate);
  });

  it("matrícula voluntária e certificado ainda indisponível (404)", async () => {
    const session = await signIn("aurora", "helena");
    const actor = (await resolveActor(headersWith(session.cookie)))!;
    const id = await courseId("aurora", "Autoconhecimento");
    const res = await call(enrollRoute.POST, { path: `/api/v1/courses/${id}/enroll`, method: "POST", cookie: session.cookie, params: { id } });
    expect(res.status).toBe(200);
    expect(res.json.nextLessonId).toBeTruthy();
    await expect(getMyCertificate(actor, id)).rejects.toMatchObject({ status: 404 });
  });

  it("curso de outra empresa e curso em rascunho são invisíveis", async () => {
    const session = await signIn("aurora", "fernando");
    const foreign = await courseId("horizonte", "Autoconhecimento");
    expect((await call(enrollRoute.POST, { path: "/x", method: "POST", cookie: session.cookie, params: { id: foreign } })).status).toBe(404);

    const { db } = await testDatabase();
    const draft = await courseId("aurora", "Resiliência");
    await db.update(s.courses).set({ status: "draft" }).where(eq(s.courses.id, draft));
    expect((await call(enrollRoute.POST, { path: "/x", method: "POST", cookie: session.cookie, params: { id: draft } })).status).toBe(404);
    const actor = (await resolveActor(headersWith(session.cookie)))!;
    expect((await listCatalog(actor, "cursos")).some((c) => c.id === draft)).toBe(false);
  });

  it("horas de aprendizado cobrem os últimos 6 meses, inclusive meses vazios", async () => {
    const actor = (await resolveActor(headersWith((await signIn("aurora", "fernando")).cookie)))!;
    const months = await learningHoursByMonth(actor);
    expect(months).toHaveLength(6);
    expect(months.reduce((sum, m) => sum + m.minutes, 0)).toBeGreaterThan(0);
  });
});
