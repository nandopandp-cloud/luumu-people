import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated, signIn } from "./helpers";

test.describe("Desenvolvimento", () => {
  test("colaborador acompanha o PDI, adiciona e conclui uma ação", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "camila.oliveira@aurora.example");
    await gotoHydrated(page, "/desenvolvimento");
    await expect(page.getByRole("heading", { level: 1, name: "Desenvolvimento" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Meu PDI" })).toBeVisible();
    await expectAccessible(page);

    await gotoHydrated(page, "/desenvolvimento?aba=pdi");
    const goal = page.locator("article").filter({ has: page.getByRole("heading", { name: "Melhorar comunicação" }) });
    await expect(goal).toBeVisible();
    await expectAccessible(page);

    await goal.getByRole("button", { name: "Adicionar ação" }).click();
    const dialog = page.getByRole("dialog", { name: "Nova ação" });
    await dialog.getByLabel("O que será feito?").fill("Apresentar a retrospectiva do trimestre");
    await dialog.getByRole("button", { name: "Adicionar ação" }).click();
    await expect(dialog).toBeHidden();
    const action = goal.getByRole("listitem").filter({ hasText: "Apresentar a retrospectiva do trimestre" });
    await expect(action).toBeVisible();

    await action.getByRole("button", { name: "Concluir" }).click();
    const done = page.getByRole("dialog", { name: "Concluir ação" });
    await done.getByLabel("Evidência (opcional)", { exact: true }).fill("Apresentei para o time de produto.");
    await done.getByRole("button", { name: "Concluir" }).click();
    await expect(done).toBeHidden();
    await expect(action.getByLabel("Concluída")).toBeVisible();
    await expect(action.getByText("Com evidência")).toBeVisible();
  });

  test("competências e evolução são acessíveis", async ({ page }) => {
    await signIn(page, "camila.oliveira@aurora.example");
    await gotoHydrated(page, "/desenvolvimento?aba=competencias");
    await expect(page.getByRole("img", { name: /^Comunicação: atual/ })).toBeVisible();
    await expectAccessible(page);
    await gotoHydrated(page, "/desenvolvimento?aba=evolucao");
    await expect(page.getByText("Média das competências")).toBeVisible();
    await expectAccessible(page);
  });

  test("gestor acompanha a equipe e avalia uma competência", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "carla.mendes@aurora.example");
    await gotoHydrated(page, "/gestao/desenvolvimento");
    await expect(page.getByRole("heading", { name: "Lacunas de competências" })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "Camila Oliveira" });
    await expect(row).toBeVisible();
    await expectAccessible(page);

    await row.getByRole("link", { name: "Ver desenvolvimento" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Camila Oliveira" })).toBeVisible();
    await gotoHydrated(page, `${new URL(page.url()).pathname}?aba=competencias`);
    await expectAccessible(page);

    const card = page.getByRole("listitem").filter({ hasText: "Gestão do Tempo" });
    await card.getByRole("button", { name: "Avaliar" }).click();
    const dialog = page.getByRole("dialog", { name: "Avaliar: Gestão do Tempo" });
    await dialog.getByRole("radio", { name: /Referência/ }).click();
    await dialog.getByRole("button", { name: "Registrar avaliação" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("img", { name: "Gestão do Tempo: atual 100%, esperado 70%" })).toBeVisible();
  });
});
