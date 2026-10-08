import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated, signIn } from "./helpers";

test.describe("Shell", () => {
  test("sidebar recolhe, mantém a escolha após recarregar e expande de novo", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/inicio");
    const sidebar = page.locator("#sidebar-colaborador");
    await expect(sidebar).toHaveCSS("width", "248px");

    await page.getByRole("button", { name: "Recolher menu" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-sidebar", "collapsed");
    await expect(sidebar).toHaveCSS("width", "84px");
    // Os itens continuam com nome acessível (texto visível só para leitores de tela).
    await expect(sidebar.getByRole("link", { name: "Trilhas" })).toBeVisible();
    await expectAccessible(page);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveAttribute("data-sidebar", "collapsed");
    await expect(sidebar).toHaveCSS("width", "84px");

    await page.getByRole("button", { name: "Expandir menu" }).click();
    await expect(sidebar).toHaveCSS("width", "248px");
  });

  test("busca em lightbox: atalho, resultados agrupados e navegação por teclado", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/inicio");
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog", { name: "Buscar na plataforma" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Acesso rápido")).toBeVisible();

    await dialog.getByRole("combobox", { name: "Buscar" }).fill("lideranca");
    await expect(dialog.getByRole("option", { name: /Desenvolvimento de Liderança/ })).toBeVisible();
    await expect(dialog.getByRole("group", { name: "Trilhas" })).toBeVisible();
    await expectAccessible(page);

    // Desce até a trilha e abre com Enter.
    const options = dialog.getByRole("option");
    const target = await options.evaluateAll((els) => els.findIndex((e) => e.textContent?.includes("Desenvolvimento de Liderança")));
    for (let i = 0; i < target; i++) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/trilhas\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Desenvolvimento de Liderança" })).toBeVisible();

    // Busca recente aparece na próxima abertura.
    await page.getByRole("button", { name: /Buscar cursos, trilhas/ }).click();
    await expect(page.getByRole("button", { name: "lideranca" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("conquistas ficam ocultas", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/inicio");
    await expect(page.locator("#sidebar-colaborador").getByRole("link", { name: "Meu perfil" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Minhas conquistas" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Minhas conquistas" })).toHaveCount(0);
    // Com streaming, o status já saiu como 200; o conteúdo é o "não encontrado".
    await page.goto("/minhas-conquistas");
    await expect(page.getByText("Não encontramos esta página")).toBeVisible();
  });
});

test.describe("Banners da home", () => {
  test("editora cria um banner e ele entra no carrossel da home", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "rafael.lima@aurora.example");
    await gotoHydrated(page, "/gestao/comunicacao/banners");
    await expect(page.getByRole("heading", { level: 1, name: "Banners da home" })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Novo banner" }).first().click();
    await page.waitForURL("**/banners/novo");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Título").fill("Hackathon de inovação");
    await page.getByLabel("Texto de apoio").fill("Inscrições abertas até sexta.");
    await page.getByLabel("Texto do botão").fill("Ver comunicados");
    await page.getByLabel("Destino do botão").fill("/comunicados");
    await page.getByLabel("Cor de fundo").selectOption("orange");
    // A prévia acompanha a digitação.
    await expect(page.getByText("Hackathon de inovação").first()).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Criar banner" }).click();
    await page.waitForURL("**/gestao/comunicacao/banners");
    await expect(page.getByRole("link", { name: "Hackathon de inovação", exact: true }).filter({ visible: true })).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/inicio");
    const carousel = page.getByRole("region", { name: "Destaques" });
    await expect(carousel).toBeVisible();
    await carousel.getByRole("button", { name: /Ir para o banner 2: Hackathon de inovação/ }).click();
    await expect(page.getByRole("heading", { name: "Hackathon de inovação" })).toBeVisible();
    await page.waitForTimeout(600); // fim da animação de troca (o axe mede a opacidade)
    await expect(carousel.getByRole("link", { name: /Ver comunicados/ })).toHaveAttribute("href", "/comunicados");
    await expectAccessible(page);
  });
});
