import { chromium, type FullConfig } from "@playwright/test";
import { PASSWORD } from "./helpers";

/**
 * Aquece o servidor de desenvolvimento: compila as rotas principais antes dos
 * testes (a primeira compilação de cada rota pode levar dezenas de segundos).
 */
export default async function warmup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3100";
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  page.setDefaultTimeout(180_000);
  const visit = async (path: string) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  };
  for (const [email, paths] of [
    ["fernando.santos@aurora.example", ["/inicio", "/meu-perfil", "/meu-perfil?aba=meus-dados", "/gestao/usuarios"]],
    ["paula.ribeiro@aurora.example", ["/gestao", "/gestao/usuarios", "/gestao/auditoria"]],
  ] as const) {
    await page.context().clearCookies();
    await visit("/entrar");
    await page.getByLabel("E-mail corporativo").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL("**/inicio");
    for (const path of paths) await visit(path);
  }
  await browser.close();
}
