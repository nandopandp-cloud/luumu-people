import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated, signIn } from "./helpers";

test.describe("Amigos", () => {
  test("conversa privada em tempo real, pedidos, busca de pessoas e grupo", async ({ page, browser }) => {
    test.setTimeout(180_000);
    await signIn(page, "fernando.santos@aurora.example");
    await page.getByRole("navigation", { name: "Navegação principal" }).first().getByRole("link", { name: /^Amigos/ }).click();
    await page.waitForURL("**/amigos");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1, name: "Amigos" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Solicitações 2/ })).toBeVisible();
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
    await gotoHydrated(carla, "/amigos");
    await carla.getByRole("list", { name: "Conversas" }).getByRole("button", { name: /Fernando Santos/ }).click();
    const carlaChat = carla.getByRole("region", { name: "Fernando Santos" });
    await expect(carlaChat.getByText("Combinado! Começo amanhã cedo 🚀")).toBeVisible();
    await carlaChat.getByRole("textbox", { name: "Mensagem" }).fill("Fechado, até amanhã!");
    await carlaChat.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(chat.getByText("Fechado, até amanhã!")).toBeVisible({ timeout: 20_000 });
    await carlaContext.close();

    // O sino avisa dos pedidos de amizade recebidos.
    await page.getByRole("button", { name: /^Notificações:/ }).click();
    const bell = page.getByRole("dialog", { name: "Notificações" });
    await expect(bell.getByText("Novo pedido de amizade").first()).toBeVisible();
    await page.keyboard.press("Escape");

    // Pedidos recebidos: aceitar a Amanda.
    await page.getByRole("tab", { name: /Solicitações/ }).click();
    await page.getByRole("button", { name: "Aceitar pedido de Amanda Teixeira" }).click();
    await expect(page.getByText("Agora vocês são amigos! 💜").first()).toBeVisible();
    await expectAccessible(page);

    // Pessoas: buscar e adicionar.
    await page.getByRole("tab", { name: "Pessoas" }).click();
    await page.getByRole("searchbox", { name: "Buscar pessoas" }).fill("Marcos");
    await page.getByRole("button", { name: "Adicionar Marcos Vieira como amigo" }).click();
    await expect(page.getByText("Pedido de amizade enviado.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Pedido enviado: cancelar o pedido para Marcos Vieira" })).toBeEnabled();
    await expectAccessible(page);

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
    await gotoHydrated(page, "/amigos?aba=pessoas");
    await page.getByRole("searchbox", { name: "Buscar pessoas" }).fill("Rafael");
    await page.getByRole("button", { name: /Rafael Lima/ }).first().click();
    await page.getByRole("complementary", { name: "Perfil" }).getByRole("link", { name: "Ver perfil" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Rafael Lima" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Designers Luumu/ })).toBeVisible();
    await expectAccessible(page);
  });

  test("@mobile lista, conversa e volta", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/amigos");
    await page.getByRole("list", { name: "Conversas" }).getByRole("button", { name: /Rafael Lima/ }).click();
    const chat = page.getByRole("region", { name: "Rafael Lima" });
    await expect(chat.getByText("Te mando o material aqui")).toBeVisible();
    await expectAccessible(page);
    await chat.getByRole("button", { name: "Voltar para a lista" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Amigos" })).toBeVisible();
  });
});
