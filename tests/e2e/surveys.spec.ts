import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated, signIn } from "./helpers";

test.describe("Pesquisas", () => {
  test("colaborador responde a pesquisa de clima de forma anônima", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/pesquisas");
    await expect(page.getByRole("heading", { name: "Para responder (1)" })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Responder pesquisa" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Pesquisa de Clima 2026" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Sua resposta é anônima. Evite inserir informações que possam identificar você ou outra pessoa.").first()).toBeVisible();
    await expectAccessible(page);

    // Enviar incompleto aponta o que falta.
    await page.getByRole("button", { name: "Enviar respostas" }).click();
    await expect(page.getByText("Faltam 7 perguntas obrigatórias.")).toBeVisible();

    const groups = page.getByRole("group");
    for (let i = 0; i < 5; i++) await groups.nth(i).getByText("4", { exact: true }).click();
    await groups.nth(5).getByRole("radio", { name: "9" }).check({ force: true });
    await groups.nth(6).getByText("Aprendizado").click();
    await page.getByLabel(/O que podemos fazer/).fill("Mais rituais de feedback.");
    await page.getByRole("button", { name: "Enviar respostas" }).click();
    await expect(page.getByRole("heading", { name: "Obrigado por participar!" })).toBeVisible();

    await gotoHydrated(page, "/pesquisas");
    await expect(page.getByRole("heading", { name: "Para responder (0)" })).toBeVisible();
    await expect(page.getByText("Respondida").first()).toBeVisible();
  });

  test("G&G vê resultados agregados, segmentados sem expor grupos pequenos", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "paula.ribeiro@aurora.example");
    await gotoHydrated(page, "/gestao/pesquisas");
    await expect(page.getByRole("heading", { level: 1, name: "Pesquisas" })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Pesquisa de Clima 2026" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Pesquisa de Clima 2026" })).toBeVisible();
    await expect(page.getByText("média de 1 a 5").first()).toBeVisible();
    await expect(page.getByText(/eNPS \(de −100 a 100\)/)).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Por diretoria" }).click();
    await expect(page.getByRole("list", { name: "Grupos de Diretoria" })).toBeVisible();
    await expect(page.getByText(/Grupos com poucas respostas são reunidos em “Outros”/)).toBeVisible();
  });

  test("builder: rascunho a partir de modelo", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "juliana.mendes@aurora.example");
    await gotoHydrated(page, "/gestao/pesquisas/nova");
    await page.getByLabel("Título", { exact: true }).fill("Pulso de onboarding");
    page.once("dialog", (dialog) => dialog.accept()); // substituir as perguntas do modelo inicial
    await page.getByRole("button", { name: "Pulso", exact: true }).click();
    await expect(page.getByLabel("Texto da pergunta 1")).toHaveValue("Minha carga de trabalho está adequada.");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await page.waitForURL(/\/gestao\/pesquisas\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Editar pesquisa" })).toBeVisible();
    // A página anterior (nova) continua montada, oculta, após a navegação.
    await expect(page.getByLabel("Título", { exact: true }).filter({ visible: true })).toHaveValue("Pulso de onboarding");
  });
});
