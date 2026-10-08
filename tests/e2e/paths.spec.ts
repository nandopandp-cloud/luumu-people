import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated, signIn } from "./helpers";

test.describe("Trilhas", () => {
  test("da lista à próxima aula da trilha", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/trilhas");
    await expect(page.getByRole("heading", { level: 1, name: "Trilhas de Aprendizagem" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Todas as trilhas (4)" })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("navigation", { name: "Situação das trilhas" }).getByRole("link", { name: "Em andamento" }).click();
    await expect(page.getByRole("heading", { name: "Em andamento (2)" })).toBeVisible();

    await page.getByRole("heading", { name: "Desenvolvimento de Liderança" }).getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1, name: "Desenvolvimento de Liderança" })).toBeVisible();
    // A lista anterior continua montada (oculta) após a navegação.
    await expect(page.getByText("1 de 6 cursos concluídos").filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cursos da trilha" })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("button", { name: "Continuar trilha" }).click();
    await page.waitForURL("**/aulas/**");
    await expect(page.getByText("Feedback que transforma").first()).toBeVisible();
  });

  test("curso leva de volta à sua trilha", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/meus-cursos");
    await page.getByRole("heading", { name: "Feedback que transforma" }).getByRole("link").click();
    await page.getByRole("link", { name: "Trilha Desenvolvimento de Liderança" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Desenvolvimento de Liderança" })).toBeVisible();
  });

  test("trilhas no celular @mobile", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/trilhas");
    await expect(page.getByRole("heading", { level: 1, name: "Trilhas de Aprendizagem" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expectAccessible(page);
  });
});
