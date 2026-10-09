import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated, signIn } from "./helpers";

test.describe("Comunicados", () => {
  test("mural, filtro por categoria e leitura do comunicado", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/comunicados");
    await expect(page.getByRole("heading", { level: 1, name: "Comunicados" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nova política de trabalho híbrido" })).toBeVisible();
    await expect(page.getByText("Festa de fim de ano")).toHaveCount(0);
    await expectAccessible(page);

    await page.getByRole("region", { name: "Filtrar comunicados" }).getByLabel("Categoria").selectOption("seguranca");
    await expect(page).toHaveURL(/categoria=seguranca/);
    await expect(page.getByRole("heading", { name: "Simulado de evacuação do prédio" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nova política de trabalho híbrido" })).toHaveCount(0);

    await page.getByRole("link", { name: "Simulado de evacuação do prédio" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Simulado de evacuação do prédio" })).toBeVisible();
    await expect(page.getByText(/pessoas brigadistas/)).toBeVisible();
    await expectAccessible(page);
  });

  test("editora cria e publica; o comunicado chega ao mural", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "rafael.lima@aurora.example");
    await gotoHydrated(page, "/gestao/comunicacao");
    await expect(page.getByRole("heading", { level: 1, name: "Comunicação" })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Novo comunicado" }).first().click();
    await page.waitForURL("**/gestao/comunicacao/novo");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Título").fill("Café com a diretoria");
    await page.getByLabel("Resumo").fill("Bate-papo aberto na sexta, às 10h.");
    await page.getByLabel("Texto completo").fill("Traga suas perguntas.\n\nHaverá transmissão para quem estiver remoto.");
    await page.getByLabel("Categoria").selectOption("evento");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Publicar agora" }).click();
    await page.waitForURL("**/gestao/comunicacao");
    await expect(page.getByRole("link", { name: "Café com a diretoria" })).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/comunicados?categoria=evento");
    await expect(page.getByRole("heading", { name: "Café com a diretoria" })).toBeVisible();
  });

  test("colaborador não acessa a gestão de comunicados", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await page.goto("/gestao/comunicacao");
    await expect(page.getByText("Esta área não está disponível para você")).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  });
});
