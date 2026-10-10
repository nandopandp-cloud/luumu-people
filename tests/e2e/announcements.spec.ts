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
    await page.getByRole("textbox", { name: "Resumo", exact: true }).fill("Bate-papo aberto na sexta, às 10h.");
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

  test("gestão: indicadores, busca, filtro, menu de ações e arquivar em lote", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "rafael.lima@aurora.example");
    await gotoHydrated(page, "/gestao/comunicacao");
    const summary = page.getByRole("region", { name: "Resumo dos comunicados" });
    await expect(summary.getByText("Total de comunicados")).toBeVisible();
    await expect(summary.getByText("Agendados")).toBeVisible();

    // Busca sem acento encontra o título acentuado.
    await page.getByRole("searchbox", { name: "Buscar comunicados" }).fill("saude mental");
    await page.getByRole("searchbox", { name: "Buscar comunicados" }).press("Enter");
    await expect(page).toHaveURL(/q=saude/);
    const table = page.getByRole("table");
    await expect(table.getByRole("link", { name: "Programa de Saúde Mental" })).toBeVisible();
    await expect(table.getByRole("row")).toHaveCount(2);

    // Filtro por categoria.
    await gotoHydrated(page, "/gestao/comunicacao");
    await page.getByRole("button", { name: /Filtros/ }).click();
    const dialog = page.getByRole("dialog", { name: "Filtrar comunicados" });
    await dialog.getByLabel("Categoria").selectOption("seguranca");
    await dialog.getByRole("button", { name: "Aplicar" }).click();
    await expect(page).toHaveURL(/categoria=seguranca/);
    await expect(table.getByRole("link", { name: "Simulado de evacuação do prédio" })).toBeVisible();
    await expectAccessible(page);

    // Menu de ações da linha.
    await page.getByRole("button", { name: "Ações de “Simulado de evacuação do prédio”" }).click();
    await expect(page.getByRole("menuitem", { name: "Editar" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Ver no mural" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Seleção em lote: arquivar.
    await page.getByRole("checkbox", { name: "Selecionar “Simulado de evacuação do prédio”" }).click();
    const bulk = page.getByRole("region", { name: "Ações em lote" });
    await expect(bulk.getByText("1 selecionado")).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await bulk.getByRole("button", { name: /Arquivar \(1\)/ }).click();
    await expect(page.getByText("Comunicado arquivado").first()).toBeVisible();
    await gotoHydrated(page, "/gestao/comunicacao?filtro=arquivados");
    await expect(table.getByRole("link", { name: "Simulado de evacuação do prédio" })).toBeVisible();
  });

  test("colaborador não acessa a gestão de comunicados", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await page.goto("/gestao/comunicacao");
    await expect(page.getByText("Esta área não está disponível para você")).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  });
});
