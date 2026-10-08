import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { resolveActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { completeLesson, getCourse } from "@/server/modules/courses/service";
import { getPath, listPaths } from "@/server/modules/learning/service";
import { headersWith, signIn } from "../support/auth";
import { tenantOf, testDatabase } from "../support/db";

async function actorFor(key: string) {
  return (await resolveActor(headersWith((await signIn("aurora", key)).cookie)))!;
}

async function pathId(slug: string, title: string) {
  const { db } = await testDatabase();
  const tenant = await tenantOf(slug);
  const [row] = await db.select({ id: s.learningPaths.id }).from(s.learningPaths).where(and(eq(s.learningPaths.tenantId, tenant.tenantId), eq(s.learningPaths.title, title)));
  return row!.id;
}

describe("trilhas do colaborador", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("lista as trilhas publicadas com a situação da pessoa", async () => {
    const actor = await actorFor("fernando");
    const { items, counts } = await listPaths(actor, "todas");
    expect(counts).toEqual({ todas: 4, "em-andamento": 2, "nao-iniciadas": 2, concluidas: 0 });
    expect(items.map((p) => p.title)).toEqual(["Desenvolvimento de Liderança", "Comunicação Eficaz", "Inteligência Emocional", "Gestão de Pessoas"]);
    expect(items[0]).toMatchObject({ courseCount: 6, completedCount: 1, progress: 25, status: "in_progress", totalMinutes: 720 });

    const next = await getCourse(actor, items[0]!.nextCourseId!);
    expect(next.course.title).toBe("Feedback que transforma");
    expect(next.pathId).toBe(items[0]!.id);

    const notStarted = await listPaths(actor, "nao-iniciadas");
    expect(notStarted.items.map((p) => p.title)).toEqual(["Inteligência Emocional", "Gestão de Pessoas"]);
  });

  it("detalhe traz os cursos em ordem e aponta o próximo", async () => {
    const actor = await actorFor("fernando");
    const data = await getPath(actor, await pathId("aurora", "Comunicação Eficaz"));
    expect(data.courses.map((c) => [c.title, c.status, c.progress])).toEqual([
      ["Comunicação Não Violenta", "in_progress", 83],
      ["Escuta ativa", "completed", 100],
      ["Apresentações que engajam", "in_progress", 33],
      ["Escrita clara no trabalho", "available", 0],
    ]);
    expect(data).toMatchObject({ status: "in_progress", completedCount: 1, totalMinutes: 480 });
    expect(data.nextCourseId).toBe(data.courses[0]!.id);
  });

  it("concluir todos os cursos conclui a trilha", async () => {
    const actor = await actorFor("isabela");
    const id = await pathId("aurora", "Gestão de Pessoas");
    const before = await getPath(actor, id);
    expect(before.status).toBe("not_started");

    for (const course of before.courses) {
      const { lessons } = await getCourse(actor, course.id);
      for (const lesson of lessons) await completeLesson(actor, course.id, lesson.id);
    }
    const after = await getPath(actor, id);
    expect(after).toMatchObject({ status: "completed", progress: 100, completedCount: before.courses.length, nextCourseId: null });
    expect((await listPaths(actor, "concluidas")).items.map((p) => p.id)).toEqual([id]);
  });

  it("trilha em rascunho ou de outra empresa responde 404", async () => {
    const { db } = await testDatabase();
    const tenant = await tenantOf("aurora");
    const [draft] = await db.insert(s.learningPaths).values({ tenantId: tenant.tenantId, title: "Rascunho interno", status: "draft" }).returning({ id: s.learningPaths.id });
    const actor = await actorFor("fernando");

    await expect(getPath(actor, draft!.id)).rejects.toMatchObject({ status: 404 });
    await expect(getPath(actor, await pathId("horizonte", "Comunicação Eficaz"))).rejects.toMatchObject({ status: 404 });
    expect((await listPaths(actor, "todas")).items.some((p) => p.id === draft!.id)).toBe(false);
  });
});
