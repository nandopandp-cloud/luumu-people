import path from "node:path";
import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated, signIn } from "./helpers";

test.describe("Desenvolvimento", () => {
  test("colaborador acompanha o PDI e conclui uma ação com evidência, sem lançar metas", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "camila.oliveira@aurora.example");
    await gotoHydrated(page, "/desenvolvimento");
    await expect(page.getByRole("heading", { level: 1, name: "Desenvolvimento" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Meu PDI" })).toBeVisible();
    await expectAccessible(page);

    await gotoHydrated(page, "/desenvolvimento?aba=pdi");
    const goal = page.locator("article").filter({ has: page.getByRole("heading", { name: "Desenvolver visão estratégica" }) });
    await expect(goal).toBeVisible();
    // Metas e ações são lançadas pela liderança.
    await expect(page.getByRole("button", { name: "Adicionar meta" })).toHaveCount(0);
    await expect(goal.getByRole("button", { name: "Adicionar ação" })).toHaveCount(0);
    await expectAccessible(page);

    const action = goal.getByRole("listitem").filter({ hasText: "Participar do planejamento trimestral" });
    await action.getByRole("button", { name: "Concluir" }).click();
    const done = page.getByRole("dialog", { name: "Concluir ação" });
    await done.getByLabel("Evidência (opcional)", { exact: true }).fill("Participei e apresentei os indicadores.");
    await done.getByRole("button", { name: "Concluir" }).click();
    await expect(done).toBeHidden();
    await expect(action.getByLabel("Concluída")).toBeVisible();
    await expect(action.getByText("Com evidência")).toBeVisible();
  });

  test("competências e evolução são acessíveis e sem autoavaliação", async ({ page }) => {
    await signIn(page, "camila.oliveira@aurora.example");
    await gotoHydrated(page, "/desenvolvimento?aba=competencias");
    await expect(page.getByRole("img", { name: /^Comunicação: atual/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Autoavaliar|Avaliar/ })).toHaveCount(0);
    await expectAccessible(page);
    await gotoHydrated(page, "/desenvolvimento?aba=evolucao");
    await expect(page.getByText("Média das competências")).toBeVisible();
    await expectAccessible(page);
  });

  test("gestora vê o relatório da pessoa, lança meta e ação e avalia uma competência", async ({ page }) => {
    test.setTimeout(150_000);
    await signIn(page, "carla.mendes@aurora.example");
    await gotoHydrated(page, "/gestao/desenvolvimento");
    await expect(page.getByRole("heading", { name: "Lacunas de competências" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Buscar pessoa" }).fill("camila");
    const row = page.getByRole("row").filter({ hasText: "Camila Oliveira" });
    await expect(row).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Gabriel Rocha" })).toHaveCount(0);
    await expectAccessible(page);

    await row.getByRole("link", { name: "Ver desenvolvimento de Camila Oliveira" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Camila Oliveira" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Metas de desenvolvimento" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectAccessible(page);
    const base = new URL(page.url()).pathname;

    await gotoHydrated(page, `${base}?aba=pdi`);
    await page.getByRole("button", { name: "Adicionar meta" }).click();
    const goalDialog = page.getByRole("dialog", { name: "Nova meta de desenvolvimento" });
    await goalDialog.getByLabel("Objetivo").fill("Conduzir rituais do time");
    await goalDialog.getByRole("button", { name: "Adicionar meta" }).click();
    await expect(goalDialog).toBeHidden();
    const goal = page.locator("article").filter({ has: page.getByRole("heading", { name: "Conduzir rituais do time" }) });
    await goal.getByRole("button", { name: "Adicionar ação" }).click();
    const actionDialog = page.getByRole("dialog", { name: "Nova ação" });
    await actionDialog.getByLabel("O que será feito?").fill("Facilitar a retrospectiva");
    await actionDialog.getByRole("button", { name: "Adicionar ação" }).click();
    await expect(actionDialog).toBeHidden();
    await expect(goal.getByText("Facilitar a retrospectiva")).toBeVisible();

    await gotoHydrated(page, `${base}?aba=competencias`);
    const card = page.getByRole("listitem").filter({ hasText: "Gestão do Tempo" });
    await card.getByRole("button", { name: "Avaliar" }).click();
    const dialog = page.getByRole("dialog", { name: "Avaliar: Gestão do Tempo" });
    await dialog.getByRole("radio", { name: /Referência/ }).click();
    await dialog.getByRole("button", { name: "Registrar avaliação" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("img", { name: "Gestão do Tempo: atual 100%, esperado 70%" })).toBeVisible();

    await gotoHydrated(page, `${base}?aba=historico`);
    await expect(page.getByRole("cell", { name: "Gestão do Tempo" }).first()).toBeVisible();
    await expectAccessible(page);
  });

  test("relatórios: mapa de competências da equipe", async ({ page }) => {
    await signIn(page, "carla.mendes@aurora.example");
    await gotoHydrated(page, "/gestao/relatorios");
    await expect(page.getByRole("heading", { name: "Mapa de competências" })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: /Camila Oliveira/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Exportar CSV" })).toHaveCount(0);
    await expectAccessible(page);
  });
});

test.describe("Perfil", () => {
  test("foto com editor (zoom, rotação) e capa personalizada", async ({ page }) => {
    test.setTimeout(120_000);
    const image = path.join(process.cwd(), "public/images/login-scene.webp");
    await signIn(page, "gabriel.rocha@aurora.example");
    await gotoHydrated(page, "/meu-perfil");

    await page.getByRole("button", { name: "Trocar foto do perfil" }).locator("..").locator('input[type="file"]').setInputFiles(image);
    const editor = page.getByRole("dialog", { name: "Ajustar foto do perfil" });
    await expect(editor).toBeVisible();
    await editor.getByLabel("Zoom").fill("2");
    await editor.getByRole("button", { name: "Girar à direita" }).click();
    await expect(editor.getByText("90°")).toBeVisible();
    await expectAccessible(page);
    await editor.getByRole("button", { name: "Salvar" }).click();
    await expect(editor).toBeHidden();
    await expect(page.getByText("Foto atualizada!").first()).toBeVisible();

    await page.getByRole("button", { name: "Alterar capa" }).locator("..").locator('input[type="file"]').setInputFiles(image);
    const coverEditor = page.getByRole("dialog", { name: "Ajustar capa do perfil" });
    await coverEditor.getByRole("button", { name: "Salvar" }).click();
    await expect(coverEditor).toBeHidden();
    await expect(page.getByText("Capa atualizada!").first()).toBeVisible();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator('section img[src^="/api/v1/files/"]').first()).toBeVisible();
    await expectAccessible(page);
  });
});
