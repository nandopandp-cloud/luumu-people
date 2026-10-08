import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated, signIn } from "./helpers";

test.describe("Meus cursos", () => {
  test("da descoberta ao certificado", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "natalia.cunha@aurora.example");
    await gotoHydrated(page, "/meus-cursos?q=Autoconhecimento");
    await expect(page.getByRole("heading", { level: 1, name: "Meus cursos" })).toBeVisible();
    await expectAccessible(page);

    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: "Autoconhecimento" }) }).last();
    await card.getByRole("button", { name: "Iniciar" }).click();
    await page.waitForURL("**/aulas/**");
    await page.waitForLoadState("networkidle");
    await expectAccessible(page);

    for (let i = 0; i < 5; i++) {
      await page.getByRole("button", { name: "Concluir e avançar" }).click();
      await expect(page.getByText(`Aula ${i + 2} de 6`)).toBeVisible();
    }
    await page.getByRole("button", { name: "Concluir curso" }).click();
    await expect(page.getByRole("dialog", { name: /curso concluído/ })).toBeVisible();
    await page.getByRole("link", { name: "Ver certificado" }).click();
    await page.waitForURL("**/certificados/**");
    await expect(page.getByRole("heading", { name: "Natália Cunha" })).toBeVisible();
    await expect(page.getByText(/Código de verificação/)).toBeVisible();
    await expectAccessible(page);
  });

  test("página do curso lista módulos e aulas e é acessível", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/meus-cursos");
    await page.getByRole("heading", { name: "Feedback que transforma" }).getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1, name: "Feedback que transforma" })).toBeVisible();
    await expect(page.getByText("Módulo 2 · Na prática")).toBeVisible();
    await expect(page.getByText("3 de 6 aulas concluídas")).toBeVisible();
    await expectAccessible(page);
  });
});
