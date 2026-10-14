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

  test("login: tela cheia sem rolagem, só Google como SSO e validação dos campos", async ({ page }) => {
    await gotoHydrated(page, "/entrar");
    await expect(page.getByRole("heading", { level: 1, name: "Bem-vindo(a)!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar com Microsoft" })).toHaveCount(0);
    await expect(page.getByText("Não tem uma conta?")).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByText("Informe seu e-mail e sua senha para entrar.")).toBeVisible();
    await expectAccessible(page);
  });

  test("@mobile login no celular: proposta e ilustração acima do formulário em cartão", async ({ page }) => {
    await gotoHydrated(page, "/entrar");
    await expect(page.getByRole("main").getByText(/^Pessoas que\s*aprendem, crescem/)).toBeVisible();
    await expect(page.getByRole("main").getByText(/^Uma plataforma de experiência/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Bem-vindo(a)!" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Entrar com Google" })).toBeVisible();
    await expect(page.getByText(/Ainda não tem acesso|Não tem uma conta/)).toHaveCount(0);
    // A ilustração do celular carrega em boa resolução.
    const widths = () =>
      page.locator('img[src*="login-scene"]').evaluateAll((list) =>
        list.map((img) => ({
          visible: (img as HTMLElement).offsetParent !== null,
          width: (img as HTMLImageElement).complete ? Number(new URL((img as HTMLImageElement).currentSrc, location.href).searchParams.get("w")) : 0,
        })),
      );
    await expect.poll(async () => (await widths()).find((i) => i.visible)?.width ?? 0).toBeGreaterThanOrEqual(640);
    // A oculta não gera download grande: só a miniatura, ou reaproveita a já baixada.
    const visibleWidth = (await widths()).find((i) => i.visible)!.width;
    const downloaded = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .filter((n) => n.includes("login-scene"))
        .map((n) => Number(new URL(n).searchParams.get("w"))),
    );
    expect(downloaded.every((w) => w === visibleWidth || w <= 48)).toBe(true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
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
    await expect(page.getByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite), Fernando!/ })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("button", { name: /^Menu da conta de / }).click();
    await page.getByRole("menuitem", { name: "Meu perfil" }).click();
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
    // Dashboard da gestora: sem uso da plataforma nem auditoria (são da empresa toda).
    await gotoHydrated(page, "/gestao");
    await expect(page.getByRole("heading", { name: /Olá, Carla!/ })).toBeVisible();
    await expect(page.getByText("Pessoas na sua equipe")).toBeVisible();
    await expect(page.getByRole("region", { name: "Visão da plataforma" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Atividade recente" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: /Atenção necessária/ })).toBeVisible();
    await page.goto("/gestao/usuarios");
    await expect(page.getByText("Você está vendo apenas as pessoas do seu escopo").filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Fernando Santos/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /João Silva/ })).toHaveCount(0);
  });

  test("administradora: dashboard, usuários, papéis e auditoria", async ({ page }) => {
    await signIn(page, "paula.ribeiro@aurora.example");
    await gotoHydrated(page, "/gestao");
    await expect(page.getByRole("heading", { name: /Olá, Paula!/ })).toBeVisible();
    const kpis = page.getByRole("region", { name: "Indicadores" });
    for (const label of ["Colaboradores ativos", "Áreas e diretorias", "Gestores", "Admissões recentes"]) await expect(kpis.getByText(label)).toBeVisible();
    // Visão da plataforma: gráfico, tabela equivalente e troca de período.
    const usage = page.getByRole("region", { name: "Visão da plataforma" });
    await expect(usage.getByRole("img", { name: /Acessos e usuários únicos por dia, últimos 7 dias/ })).toBeVisible();
    await usage.getByRole("button", { name: "Ver como tabela" }).click();
    await expect(usage.getByRole("table").getByRole("row")).toHaveCount(8);
    await usage.getByRole("combobox", { name: "Período da visão da plataforma" }).selectOption("30");
    await expect(page).toHaveURL(/periodo=30/);
    // A escolha de ver como tabela continua valendo no novo período.
    await expect(usage.getByRole("table").getByRole("row")).toHaveCount(31);
    await usage.getByRole("button", { name: "Ver gráfico" }).click();
    await expect(usage.getByRole("img", { name: /últimos 30 dias/ })).toBeVisible();
    await expect(page.getByRole("region", { name: /Atenção necessária/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Atividade recente" }).getByRole("link", { name: "Ver auditoria completa" })).toBeVisible();
    const quick = page.getByRole("region", { name: "Ações rápidas" });
    for (const label of ["Gerenciar pessoas", "Publicar comunicado", "Criar pesquisa", "Ver auditoria"]) await expect(quick.getByRole("link", { name: new RegExp(label) })).toBeVisible();
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
    await bottomNav.getByRole("link", { name: "Conversas" }).click();
    await expect(page).toHaveURL(/\/conversas/);
    await expect(page.getByRole("heading", { level: 1, name: "Conversas" })).toBeVisible();
    await expectAccessible(page);
  });
});
