import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type Page } from "@playwright/test";
import { gotoHydrated, signIn } from "../e2e/helpers";

/**
 * Gera as imagens de docs/assets/screens. Grava fora do projeto (o dev server
 * observa a raiz e recarregaria a página); `pnpm docs:screenshots` copia no fim.
 */
const OUT = path.join(tmpdir(), "luumu-people-screens");
mkdirSync(OUT, { recursive: true });

async function shoot(page: Page, route: string, name: string) {
  await gotoHydrated(page, route);
  await closeMoodPrompt(page);
  // Fontes, imagens e animações de entrada assentadas.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(OUT, `${name}.jpg`),
    type: "jpeg",
    quality: 82,
    scale: "css",
    // Indicador de desenvolvimento do Next (não faz parte do produto).
    style: "nextjs-portal { display: none !important; }",
  });
}

/** O modal diário de sentimento cobriria a tela. */
async function closeMoodPrompt(page: Page) {
  const modal = page.getByRole("dialog", { name: "Como você está se sentindo hoje?" });
  if (await modal.isVisible().catch(() => false)) {
    await modal.getByRole("button", { name: "Fechar" }).click();
    await modal.waitFor({ state: "hidden" });
  }
}

test.describe.configure({ mode: "serial" });

test("entrada", async ({ page }) => {
  await shoot(page, "/entrar", "01-entrar");
});

test("colaborador", async ({ page }) => {
  await signIn(page, "fernando.santos@aurora.example");
  await shoot(page, "/inicio", "02-inicio");
  await shoot(page, "/comunicados", "03-comunicados");
  await shoot(page, "/trilhas", "04-trilhas");
  await shoot(page, "/meus-cursos", "05-meus-cursos");
  await shoot(page, "/desenvolvimento", "06-desenvolvimento");
  await shoot(page, "/pesquisas", "07-pesquisas");
  await shoot(page, "/amigos", "08-amigos");
  await shoot(page, "/meu-perfil", "09-meu-perfil");
});

test("gestão", async ({ page }) => {
  await signIn(page, "paula.ribeiro@aurora.example");
  await shoot(page, "/gestao", "10-gestao");
  await shoot(page, "/gestao/colaboradores", "11-gestao-colaboradores");
  await shoot(page, "/gestao/comunicacao", "12-gestao-comunicacao");
  await shoot(page, "/gestao/desenvolvimento/competencias", "13-gestao-competencias");
  await shoot(page, "/gestao/desenvolvimento", "14-gestao-desenvolvimento");
  await shoot(page, "/gestao/pesquisas", "15-gestao-pesquisas");
  await shoot(page, "/gestao/auditoria", "16-gestao-auditoria");
  await shoot(page, "/gestao/relatorios", "17-gestao-relatorios");
});

test("design system", async ({ page }) => {
  await shoot(page, "/design-system", "30-design-system");
});

test("celular @mobile", async ({ page }) => {
  await signIn(page, "fernando.santos@aurora.example");
  await shoot(page, "/inicio", "20-celular-inicio");
  await shoot(page, "/desenvolvimento", "21-celular-desenvolvimento");
  await shoot(page, "/pesquisas", "22-celular-pesquisas");
});
