import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated, signIn } from "./helpers";

test.describe("Fase 1 — fundação", () => {
  test("sem sessão, qualquer página leva ao login preservando o destino", async ({ page }) => {
    await page.goto("/meu-perfil");
    await expect(page).toHaveURL(/\/entrar\?next=%2Fmeu-perfil/);
    await expectAccessible(page);
  });

  test("senha errada mostra mensagem humana e não revela se o e-mail existe", async ({ page }) => {
    await gotoHydrated(page, "/entrar");
    await page.getByLabel("E-mail", { exact: true }).fill("fernando.santos@aurora.example");
    await page.getByLabel("Senha", { exact: true }).fill("senha-errada-123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByText("E-mail ou senha incorretos")).toBeVisible();
  });

  test("login: SSO avisa que depende da empresa e ajuda para quem não tem conta", async ({ page }) => {
    await gotoHydrated(page, "/entrar");
    await expect(page.getByRole("heading", { level: 1, name: "Bem-vindo(a) de volta!" })).toBeVisible();
    await page.getByRole("button", { name: "Entrar com Microsoft" }).click();
    await expect(page.getByText(/O acesso com Microsoft fica disponível quando a sua empresa ativar o login corporativo/)).toBeVisible();
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByText("Informe seu e-mail e sua senha para entrar.")).toBeVisible();
    await page.getByRole("button", { name: "Fale com o time da sua empresa." }).click();
    await expect(page.getByRole("dialog", { name: "Seu acesso é criado pela empresa" })).toBeVisible();
    await expectAccessible(page);
  });

  test("login com Google leva ao Google preservando o destino e mostra erros do retorno", async ({ page }) => {
    // Não sai para a internet: o redirecionamento ao Google é interceptado.
    await page.route("https://accounts.google.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Google</title>" }));
    await gotoHydrated(page, "/entrar?next=%2Fmeu-perfil");
    await page.getByRole("button", { name: "Entrar com Google" }).click();
    await page.waitForURL(/^https:\/\/accounts\.google\.com\//);
    const google = new URL(page.url());
    expect(google.searchParams.get("redirect_uri")).toMatch(/\/api\/auth\/callback\/google$/);
    expect(google.searchParams.get("prompt")).toBe("select_account");

    await gotoHydrated(page, "/entrar?error=signup_disabled");
    await expect(page.getByText(/Não encontramos um acesso à Luumu People para esta conta Google/)).toBeVisible();
    await expectAccessible(page);
  });

  test("colaborador: início, perfil e edição do próprio perfil", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await expect(page.getByText("Olá, Fernando!")).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Meu perfil" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Fernando Santos" })).toBeVisible();
    await expect(page.getByText("Carla Mendes").first()).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("button", { name: "Editar" }).first().click();
    await page.getByLabel("Frase do perfil").fill("Curiosidade é meu superpoder.");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("“Curiosidade é meu superpoder.”")).toBeVisible();
  });

  test("TESTE 6 — colaborador não acessa a gestão", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await page.goto("/gestao/usuarios");
    await expect(page.getByText("Esta área não está disponível para você")).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  });

  test("gestora vê somente a própria equipe", async ({ page }) => {
    await signIn(page, "carla.mendes@aurora.example");
    await page.goto("/gestao/usuarios");
    await expect(page.getByText("Você está vendo apenas as pessoas do seu escopo").filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Fernando Santos/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /João Silva/ })).toHaveCount(0);
  });

  test("administradora: dashboard, usuários, papéis e auditoria", async ({ page }) => {
    await signIn(page, "paula.ribeiro@aurora.example");
    await page.goto("/gestao");
    await expect(page.getByRole("heading", { name: /Olá, Paula!/ })).toBeVisible();
    await expectAccessible(page);

    await gotoHydrated(page, "/gestao/usuarios?q=gabriel");
    await expectAccessible(page);
    await page.getByRole("link", { name: /Gabriel Rocha/ }).click();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Conceder papel" }).click();
    await page.getByLabel("Papel", { exact: true }).selectOption({ label: "Editor" });
    await page.getByRole("button", { name: "Conceder", exact: true }).click();
    await expect(page.getByText("Editor", { exact: true })).toBeVisible();

    await page.goto("/gestao/auditoria?acao=access.role_granted");
    await expect(page.getByRole("cell", { name: "Papel concedido" }).first()).toBeVisible();
    await expectAccessible(page);
  });

  test("@mobile colaborador navega pela barra inferior", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    const bottomNav = page.getByRole("navigation", { name: "Navegação principal" }).last();
    await bottomNav.getByRole("link", { name: "Perfil" }).click();
    await expect(page).toHaveURL(/\/meu-perfil/);
    await expectAccessible(page);
  });
});
