import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

test.describe("Início do colaborador", () => {
  test("mostra os blocos do dia a dia com dados reais e é acessível", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await expect(page.getByRole("heading", { name: "Pessoas que aprendem hoje constroem o amanhã." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Comunicados para você" })).toBeVisible();
    await expect(page.getByText("Nova política de trabalho híbrido")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Desenvolvimento de Liderança" })).toBeVisible();
    await expect(page.getByText("4 de 9")).toBeVisible();
    await expect(page.getByText("Comunicação Não Violenta").first()).toBeVisible();
    await expectAccessible(page);
  });

  test("check-in de humor é salvo e permanece após recarregar", async ({ page }) => {
    await signIn(page, "camila.oliveira@aurora.example");
    const bem = page.getByRole("button", { name: "Bem", exact: true });
    const saved = page.waitForResponse((r) => r.url().endsWith("/api/v1/me/mood") && r.request().method() === "PUT" && r.ok());
    await bem.click();
    await saved;
    await expect(page.getByText("Obrigado por compartilhar")).toBeVisible();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Bem", exact: true })).toHaveAttribute("aria-pressed", "true");
  });
});
