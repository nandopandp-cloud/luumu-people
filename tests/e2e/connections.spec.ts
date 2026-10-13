import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated, signIn } from "./helpers";

test.describe("Conexões", () => {
  test("descobrir, conectar, aceitar, seguir, interesses e conversar", async ({ page }) => {
    test.setTimeout(150_000);
    await signIn(page, "fernando.santos@aurora.example");
    await page.getByRole("navigation", { name: "Navegação principal" }).first().getByRole("link", { name: /^Amigos/ }).click();
    await page.waitForURL("**/amigos");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1, name: "Conexões" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pessoas que você talvez conheça" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pessoas em destaque" })).toBeVisible();
    await expectAccessible(page);

    // Pedido recebido, pelo painel lateral.
    const requests = page.getByRole("region", { name: "Solicitações de amizade" });
    await requests.getByRole("button", { name: "Aceitar pedido de Amanda Teixeira" }).click();
    await expect(page.getByText(/Agora você e Amanda estão conectados/).first()).toBeVisible();

    // Busca e conectar.
    await page.getByRole("searchbox", { name: "Buscar pessoas" }).fill("Marcos");
    await expect(page.getByRole("heading", { name: /pessoas? encontradas?/ })).toBeVisible();
    await page.getByRole("button", { name: "Conectar com Marcos Vieira" }).click();
    await expect(page.getByRole("button", { name: "Pedido enviado: cancelar o pedido para Marcos Vieira" })).toBeEnabled();
    await expectAccessible(page);

    // Filtro "Mesmos interesses": todo resultado tem ao menos um interesse em comum.
    await page.getByRole("button", { name: "Limpar busca e filtros" }).click();
    await page.getByRole("button", { name: "Mesmos interesses" }).click();
    await expect(page.getByRole("heading", { name: /pessoas? encontradas?/ })).toBeVisible();
    await expect(page.getByRole("article").first().getByText(/interesses? em comum/)).toBeVisible();
    await page.getByRole("button", { name: "Limpar busca e filtros" }).click();

    // Seguir alguém em destaque.
    const follow = page.getByRole("button", { name: /^Seguir / }).first();
    const followed = (await follow.getAttribute("aria-label"))!.replace("Seguir ", "");
    await follow.click();
    await expect(page.getByRole("button", { name: `Seguindo ${followed}. Deixar de seguir` })).toBeVisible();

    // Dispensar uma sugestão.
    const dismiss = page.getByRole("button", { name: /^Dispensar sugestão: / }).first();
    const dismissed = (await dismiss.getAttribute("aria-label"))!.replace("Dispensar sugestão: ", "");
    await dismiss.click();
    await expect(page.getByRole("button", { name: `Dispensar sugestão: ${dismissed}` })).toHaveCount(0);

    // Interesses do perfil.
    await page.getByRole("button", { name: "Editar meus interesses" }).click();
    const dialog = page.getByRole("dialog", { name: "Meus interesses" });
    await dialog.getByRole("button", { name: "Música" }).click();
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Salvar interesses" }).click();
    await expect(page.getByText("Interesses salvos.").first()).toBeVisible();

    // Minhas conexões: mensagem abre o chat flutuante.
    await page.getByRole("button", { name: /^Minhas conexões/ }).click();
    await page.getByRole("button", { name: "Mensagem para Amanda Teixeira" }).click();
    await expect(page.getByRole("region", { name: "Conversas rápidas" }).getByRole("region", { name: /Amanda Teixeira/ })).toBeVisible();
    await expectAccessible(page);
  });

  test("@mobile conexões no celular", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/amigos");
    await expect(page.getByRole("heading", { level: 1, name: "Conexões" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expectAccessible(page);
  });
});
