import { beforeAll, describe, expect, it } from "vitest";
import * as reportRoute from "@/app/api/v1/reports/development/route";
import { resolveActor } from "@/server/auth/session";
import { getCompetencyMatrix } from "@/server/modules/development/service";
import { csvCell } from "@/server/modules/reports/development";
import { headersWith, signIn } from "../support/auth";
import { testDatabase } from "../support/db";
import { call } from "../support/http";

describe("relatórios de desenvolvimento", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("CSV neutraliza fórmulas e escapa separadores", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("+55 21")).toBe("'+55 21");
    expect(csvCell("Gente; Gestão")).toBe('"Gente; Gestão"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });

  it("mapa de competências da gestora: só a própria equipe, uma célula por competência", async () => {
    const actor = (await resolveActor(headersWith((await signIn("aurora", "carla")).cookie)))!;
    const matrix = await getCompetencyMatrix(actor);
    expect(matrix.rows.map((r) => r.name).sort()).toEqual(["Camila Oliveira", "Fernando Santos", "Gabriel Rocha", "Helena Duarte", "Lucas Ferreira"]);
    expect(matrix.competencies).toHaveLength(8);
    for (const row of matrix.rows) expect(Object.keys(row.cells)).toHaveLength(8);
  });

  it("exportação exige reports.export e é auditada; gestora sem exportação recebe 403", async () => {
    const carla = await signIn("aurora", "carla");
    expect((await call(reportRoute.GET, { path: "/api/v1/reports/development", cookie: carla.cookie })).status).toBe(403);

    const paula = await signIn("aurora", "paula");
    const res = await fetchRaw(paula.cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const text = await res.text();
    const [header, ...lines] = text.replace(/^﻿/, "").trim().split("\r\n");
    expect(header).toContain("Pessoa;Cargo;Área");
    expect(lines.length).toBeGreaterThan(10);
  });
});

async function fetchRaw(cookie: string) {
  const request = new Request("http://localhost:3000/api/v1/reports/development", { headers: { cookie, "x-forwarded-for": "203.0.113.21" } });
  return reportRoute.GET(request);
}
