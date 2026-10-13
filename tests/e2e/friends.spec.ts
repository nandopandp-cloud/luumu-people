import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated, signIn } from "./helpers";

test.describe("Conversas e amigos", () => {
  test("conversa privada em tempo real, curtir, editar, anexo e grupo", async ({ page, browser }) => {
    test.setTimeout(180_000);
    await signIn(page, "fernando.santos@aurora.example");
    await page.getByRole("navigation", { name: "Navegação principal" }).first().getByRole("link", { name: /^Conversas/ }).click();
    await page.waitForURL("**/conversas");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1, name: "Conversas" })).toBeVisible();
    // Pessoas e pedidos ficam em Conexões: aqui, só os atalhos.
    await expect(page.getByRole("link", { name: /^Solicitações/ })).toHaveAttribute("href", "/amigos?aba=solicitacoes");
    await expectAccessible(page);

    // Conversa com a Carla: histórico, perfil ao lado e envio.
    const list = page.getByRole("list", { name: "Conversas" });
    await list.getByRole("button", { name: /Carla Mendes/ }).click();
    const chat = page.getByRole("region", { name: "Carla Mendes" });
    await expect(chat.getByText("Show! Vamos sim! 💜")).toBeVisible();
    const profile = page.getByRole("complementary", { name: "Perfil" });
    await expect(profile.getByRole("link", { name: "Ver perfil" })).toBeVisible();
    await expect(profile.getByRole("button", { name: /Time Produto/ })).toBeVisible();
    await expectAccessible(page);

    const field = chat.getByRole("textbox", { name: "Mensagem" });
    await field.fill("Combinado! Começo amanhã 🚀");
    await field.press("Enter");
    await expect(chat.getByText("Combinado! Começo amanhã 🚀")).toBeVisible();
    await expect(field).toHaveValue("");

    // Curtir (duplo clique na bolha) e editar a própria mensagem.
    await chat.getByText("Show! Vamos sim! 💜").dblclick();
    await expect(chat.getByRole("button", { name: /^1 curtida: Fernando Santos/ })).toBeVisible();
    const mine = chat.getByRole("listitem").filter({ hasText: "Combinado! Começo amanhã 🚀" });
    await mine.hover();
    await mine.getByRole("button", { name: "Opções da mensagem" }).click();
    await page.getByRole("menuitem", { name: "Editar mensagem" }).click();
    await expect(chat.getByText("Editando mensagem")).toBeVisible();
    await field.fill("Combinado! Começo amanhã cedo 🚀");
    await field.press("Enter");
    await expect(chat.getByText("Combinado! Começo amanhã cedo 🚀")).toBeVisible();
    await expect(chat.getByText("Editando mensagem")).toHaveCount(0);
    await expect(chat.getByRole("listitem").filter({ hasText: "Combinado! Começo amanhã cedo 🚀" }).getByText(/editada/)).toBeVisible();

    // Anexo: abre no lightbox, com opção de baixar.
    await chat.locator('input[type="file"]').setInputFiles({ name: "quadro.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
    await expect(chat.getByText("quadro.png")).toBeVisible();
    await field.press("Enter");
    await chat.getByRole("button", { name: "Abrir imagem quadro.png" }).click();
    const lightbox = page.getByRole("dialog", { name: "quadro.png" });
    await expect(lightbox.getByRole("link", { name: "Baixar" })).toHaveAttribute("href", /\?download=1$/);
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(lightbox).toHaveCount(0);

    // A Carla recebe sem recarregar a página.
    const carlaContext = await browser.newContext();
    const carla = await carlaContext.newPage();
    await signIn(carla, "carla.mendes@aurora.example");
    await gotoHydrated(carla, "/conversas");
    await carla.getByRole("list", { name: "Conversas" }).getByRole("button", { name: /Fernando Santos/ }).click();
    const carlaChat = carla.getByRole("region", { name: "Fernando Santos" });
    await expect(carlaChat.getByText("Combinado! Começo amanhã cedo 🚀")).toBeVisible();
    await carlaChat.getByRole("textbox", { name: "Mensagem" }).fill("Fechado, até amanhã!");
    await carlaChat.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(chat.getByText("Fechado, até amanhã!")).toBeVisible({ timeout: 20_000 });
    await carlaContext.close();

    // Os pedidos de amizade recebidos chegam às notificações (central filtrada por Conexões).
    const central = await page.context().newPage();
    await central.goto("/notificacoes?tipos=friends");
    await expect(central.getByText("Novo pedido de amizade").first()).toBeVisible();
    await central.close();

    // Novo grupo com amigos.
    await page.getByRole("button", { name: "Nova conversa em grupo" }).click();
    const dialog = page.getByRole("dialog", { name: "Nova conversa em grupo" });
    await dialog.getByLabel("Nome do grupo").fill("Squad de testes");
    await dialog.getByRole("checkbox", { name: /Camila Oliveira/ }).click();
    await dialog.getByRole("checkbox", { name: /Gabriel Rocha/ }).click();
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Criar grupo" }).click();
    const group = page.getByRole("region", { name: "Squad de testes" });
    await expect(group.getByText("3 pessoas")).toBeVisible();
    await group.getByRole("textbox", { name: "Mensagem" }).fill("Bem-vindos ao grupo!");
    await group.getByRole("textbox", { name: "Mensagem" }).press("Enter");
    await expect(group.getByText("Bem-vindos ao grupo!")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Detalhes do grupo" }).getByText("Camila Oliveira", { exact: true }).last()).toBeVisible();
    await expectAccessible(page);
  });

  test("perfil do colega", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/amigos");
    await page.getByRole("searchbox", { name: "Buscar pessoas" }).fill("Rafael");
    await page.getByRole("article", { name: "Rafael Lima" }).getByRole("link", { name: "Rafael Lima" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Rafael Lima" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Designers Luumu/ })).toBeVisible();
    // Interesses e seguir (o Fernando já segue o Rafael no seed).
    await expect(page.getByText("Fotografia")).toBeVisible();
    await expect(page.getByRole("button", { name: "Seguindo" })).toHaveAttribute("aria-pressed", "true");
    await expectAccessible(page);
  });

  test("@mobile lista, conversa e volta", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/conversas");
    await page.getByRole("list", { name: "Conversas" }).getByRole("button", { name: /Rafael Lima/ }).click();
    const chat = page.getByRole("region", { name: "Rafael Lima" });
    await expect(chat.getByText("Te mando o material aqui")).toBeVisible();
    await expectAccessible(page);
    await chat.getByRole("button", { name: "Voltar para a lista" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Conversas" })).toBeVisible();
  });

  test("chat flutuante: acompanha a navegação, minimiza e sai da página de conversas", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "fernando.santos@aurora.example");
    const dock = page.getByRole("region", { name: "Conversas rápidas" });
    await dock.getByRole("button", { name: /^Conversas/ }).click();
    await dock.getByRole("list", { name: "Conversas" }).getByRole("button", { name: /Juliana Mendes/ }).click();
    const window = dock.getByRole("region", { name: /Juliana Mendes/ });
    await expect(window.getByText("Perfeito! Obrigada 🙏")).toBeVisible();
    await expectAccessible(page);

    // Navega pela plataforma com a conversa aberta.
    await page.getByRole("navigation", { name: "Navegação principal" }).first().getByRole("link", { name: "Comunicados" }).click();
    await page.waitForURL("**/comunicados");
    await window.getByRole("textbox", { name: "Mensagem" }).fill("Respondendo enquanto leio os comunicados 📣");
    await window.getByRole("textbox", { name: "Mensagem" }).press("Enter");
    await expect(window.getByText("Respondendo enquanto leio os comunicados 📣")).toBeVisible();

    // Minimizar e restaurar.
    await window.getByRole("button", { name: "Minimizar", exact: true }).click();
    await expect(window).toHaveCount(0);
    await dock.getByRole("button", { name: /^Abrir conversa com Juliana Mendes/ }).click();
    await expect(dock.getByRole("region", { name: /Juliana Mendes/ }).getByText("Respondendo enquanto leio os comunicados 📣")).toBeVisible();
    await dock.getByRole("button", { name: "Fechar conversa", exact: true }).click();
    await expect(dock.getByRole("region", { name: /Juliana Mendes/ })).toHaveCount(0);

    // Da página de conversas para a janela flutuante.
    await gotoHydrated(page, "/conversas");
    await expect(page.getByRole("region", { name: "Conversas rápidas" }).getByRole("button", { name: /^Conversas/ })).toHaveCount(0);
    // Repete o clique se a página ainda estiver hidratando.
    await expect(async () => {
      await page.getByRole("list", { name: "Conversas" }).getByRole("button", { name: /Rafael Lima/ }).click();
      await expect(page.getByRole("button", { name: "Abrir em janela flutuante" })).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("button", { name: "Abrir em janela flutuante" }).click();
    await expect(page.getByRole("region", { name: "Conversas rápidas" }).getByRole("region", { name: /Rafael Lima/ }).getByText("Te mando o material aqui")).toBeVisible();
    await expect(page.getByRole("region", { name: "Nenhuma conversa aberta" })).toBeVisible();
  });
});
