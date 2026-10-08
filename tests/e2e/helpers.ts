import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Luumu@Demo2026";

/** Aguarda a hidratação: preencher antes dela faz o React descartar os valores. */
export async function gotoHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

export async function signIn(page: Page, email: string) {
  await gotoHydrated(page, "/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/inicio");
}

/** WCAG 2.2 A/AA: nenhuma violação séria ou crítica. */
export async function expectAccessible(page: Page) {
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}
