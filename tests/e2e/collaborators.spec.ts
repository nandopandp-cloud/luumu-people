import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated, signIn } from "./helpers";

test.describe("Colaboradores", () => {
  test("administradora: indicadores, filtros, abas, ordenação, colunas, paginação e exportação", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "paula.ribeiro@aurora.example");
    await gotoHydrated(page, "/gestao/usuarios");
    // O endereço antigo leva à nova área.
    await expect(page).toHaveURL(/\/gestao\/colaboradores$/);
    await expect(page.getByRole("heading", { level: 1, name: "Colaboradores" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Colaboradores", exact: true }).first()).toBeVisible();
    const kpis = page.getByRole("region", { name: "Indicadores" });
    for (const label of ["Colaboradores", "Áreas", "Gestores", "Convites pendentes"]) await expect(kpis.getByText(label, { exact: true })).toBeVisible();
    await expectAccessible(page);

    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(11);
    await expect(page.getByText(/Mostrando 1–10 de \d+ resultados/)).toBeVisible();

    // Paginação numerada e itens por página.
    await page.getByRole("link", { name: "Página 2" }).click();
    await expect(page).toHaveURL(/pagina=2/);
    await expect(page.getByText(/Mostrando 11–20/)).toBeVisible();
    await page.getByLabel("Itens por página").selectOption("25");
    await expect(page).toHaveURL(/por=25/);
    await expect(table.getByRole("row")).toHaveCount(26);

    // Ordenação pelo cabeçalho.
    await page.getByRole("link", { name: /^Cargo/ }).click();
    await expect(page).toHaveURL(/ordem=cargo/);
    await expect(page.getByRole("columnheader", { name: /Cargo/ })).toHaveAttribute("aria-sort", "ascending");

    // Busca (por cargo) e filtro por área.
    await page.getByRole("searchbox", { name: "Buscar por nome, e-mail, cargo ou área" }).fill("Engenheiro");
    await expect(page).toHaveURL(/q=Engenheiro/);
    await expect(table.getByRole("row").nth(1)).toContainText("Engenheiro");

    // Colunas configuráveis.
    await page.getByRole("button", { name: "Configurar colunas" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Gestor(a)" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("columnheader", { name: /Gestor/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Configurar colunas" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Gestor(a)" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("columnheader", { name: /Gestor/ })).toHaveCount(1);

    // Seleção → exportação da seleção.
    await table.getByRole("row").nth(1).getByRole("checkbox").click();
    await expect(page.getByRole("region", { name: "Ações em lote" })).toContainText("1 pessoa selecionada");
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Exportar seleção" }).click();
    expect((await download).suggestedFilename()).toMatch(/^colaboradores-.*\.csv$/);

    // Mais filtros (drawer).
    await page.getByRole("button", { name: "Mais filtros" }).click();
    const drawer = page.getByRole("dialog", { name: "Mais filtros" });
    await expect(drawer.getByLabel("Unidade")).toBeVisible();
    await drawer.getByRole("button", { name: "Limpar" }).click();
    await expect(drawer).toBeHidden();
    await expectAccessible(page);
  });

  test("administradora cadastra e convida; a pessoa aparece em Pendentes e o convite pode ser cancelado", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "paula.ribeiro@aurora.example");
    await gotoHydrated(page, "/gestao/colaboradores");
    await page.getByRole("button", { name: "Adicionar colaborador" }).click();
    const dialog = page.getByRole("dialog", { name: "Adicionar colaborador" });
    const email = `e2e.${Date.now()}@aurora.example`;
    await dialog.getByLabel("Nome completo").fill("Renata Prado E2E");
    await dialog.getByLabel("E-mail corporativo").fill(email);
    await dialog.getByLabel("Data de admissão").click();
    await page.getByRole("grid").getByRole("button").filter({ hasText: /^1$/ }).first().click();
    await dialog.getByLabel("Área").selectOption({ index: 1 });
    await dialog.getByLabel("Cargo").selectOption("Analista");
    await dialog.getByLabel("Nível").selectOption("Pleno");
    await dialog.getByLabel("Gestor(a)").click();
    await page.getByRole("option", { name: /Carla Mendes/ }).click();
    await expect(dialog.getByLabel("Unidade")).toHaveCount(0);
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Cadastrar e convidar" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Convite enviado para Renata!").first()).toBeVisible();
    await expect(page).toHaveURL(/status=pendentes/);
    const row = page.getByRole("row").filter({ hasText: "Renata Prado E2E" });
    await expect(row.getByText("Convite pendente")).toBeVisible();

    await row.getByRole("button", { name: "Ações de Renata Prado E2E" }).click();
    await page.getByRole("menuitem", { name: "Reenviar convite" }).click();
    await expect(page.getByText("Convite reenviado para Renata.").first()).toBeVisible();

    await row.getByRole("button", { name: "Ações de Renata Prado E2E" }).click();
    await page.getByRole("menuitem", { name: "Cancelar convite" }).click();
    await page.getByRole("dialog", { name: /Cancelar o convite de Renata/ }).getByRole("button", { name: "Cancelar convite" }).click();
    await expect(page.getByText("Convite cancelado.").first()).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Renata Prado E2E" })).toHaveCount(0);
  });

  test("gestora: só a equipe, sem cadastro, exportação ou último acesso", async ({ page }) => {
    await signIn(page, "carla.mendes@aurora.example");
    await gotoHydrated(page, "/gestao/colaboradores");
    await expect(page.getByText("Você está vendo apenas as pessoas do seu escopo")).toBeVisible();
    await expect(page.getByRole("button", { name: "Adicionar colaborador" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Exportar" })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: /Último acesso/ })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Situação do vínculo" })).toHaveCount(0);
  });

  test("convite: link inválido orienta a pedir um novo", async ({ page }) => {
    await page.goto("/convite?token=invalido&error=INVALID_TOKEN");
    await expect(page.getByRole("heading", { name: /Crie sua senha/ })).toBeVisible();
    await expect(page.getByText("Este convite não é mais válido")).toBeVisible();
  });
});
