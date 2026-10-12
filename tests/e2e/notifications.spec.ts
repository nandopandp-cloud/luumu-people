import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated, signIn } from "./helpers";

test.describe("Notificações", () => {
  test("sino e central: abas, filtros, lida/não lida, preferências e marcar todas", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/inicio");

    // Sino: contador e lista suspensa.
    const bell = page.getByRole("button", { name: /^Notificações: \d+ não lidas?$/ });
    await expect(bell).toBeVisible();
    await bell.click();
    const popover = page.getByRole("dialog", { name: "Notificações" });
    await expect(popover.getByText("Você recebeu uma menção")).toBeVisible();
    await expectAccessible(page);
    await popover.getByRole("tab", { name: /^Menções/ }).click();
    await expect(popover.getByRole("tab", { name: /^Menções/ })).toHaveAttribute("aria-selected", "true");
    await expect(popover.getByText("Novo comunicado")).toHaveCount(0);
    await popover.getByRole("link", { name: /Ver todas as notificações/ }).click();
    await page.waitForURL("**/notificacoes");

    // Central.
    await expect(page.getByRole("heading", { level: 1, name: "Notificações" })).toBeVisible();
    // A central fica só no sino do topo: nada de "Notificações" na sidebar.
    await expect(page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: /Notificações/ })).toHaveCount(0);
    await expectAccessible(page);
    const unreadTab = () => page.getByRole("link", { name: /^Não lidas \(\d+\)$/ });
    const unreadCount = async () => Number(/\((\d+)\)/.exec((await unreadTab().innerText()).trim())![1]);
    const before = await unreadCount();

    // Filtro: sem comunicados.
    await page.getByRole("checkbox", { name: "Comunicados" }).click({ force: true });
    await expect(page).toHaveURL(/tipos=/);
    const list = page.getByRole("region", { name: "Lista de notificações" });
    await expect(list.getByRole("article", { name: /Novo comunicado/ })).toHaveCount(0);
    await expect(list.getByRole("article", { name: /Você recebeu uma menção/ })).toBeVisible();

    // Lida e não lida pelo menu.
    await list.getByRole("button", { name: "Mais opções: Você recebeu uma menção" }).click();
    await page.getByRole("menuitem", { name: "Marcar como lida" }).click();
    await expect.poll(unreadCount).toBe(before - 1);
    await list.getByRole("button", { name: "Mais opções: Você recebeu uma menção" }).click();
    await page.getByRole("menuitem", { name: "Marcar como não lida" }).click();
    await expect.poll(unreadCount).toBe(before);

    // Preferências: sem curtidas.
    await page.getByRole("button", { name: "Configurar preferências" }).click();
    const prefs = page.getByRole("dialog", { name: "Preferências de notificação" });
    await prefs.getByRole("switch", { name: "Receber notificações de curtidas e reações" }).click();
    await expectAccessible(page);
    await prefs.getByRole("button", { name: "Salvar preferências" }).click();
    await expect(prefs).toBeHidden();
    await gotoHydrated(page, "/notificacoes");
    await expect(page.getByRole("article", { name: /Seu comentário recebeu curtidas/ })).toHaveCount(0);
    await expect(page.getByText("Desativadas: curtidas e reações.")).toBeVisible();
    // Volta ao normal.
    await page.getByRole("button", { name: "Configurar preferências" }).click();
    await prefs.getByRole("switch", { name: "Receber notificações de curtidas e reações" }).click();
    await prefs.getByRole("button", { name: "Salvar preferências" }).click();
    await expect(prefs).toBeHidden();

    // Marcar todas como lidas zera o contador.
    await page.getByRole("button", { name: "Marcar todas como lidas" }).click();
    await expect(page.getByText(/Todas as notificações foram marcadas como lidas/).first()).toBeVisible();
    await expect.poll(unreadCount).toBe(0);
    await expect(page.getByRole("button", { name: "Notificações" })).toBeVisible();
  });

  test("menção: sugestão de nome no comentário, notificação e destaque do comentário", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "rafael.lima@aurora.example");
    await gotoHydrated(page, "/comunicados");
    await page.getByRole("link", { name: "Inscrições abertas para a Escola de Líderes" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Inscrições abertas para a Escola de Líderes" })).toBeVisible();
    await page.waitForLoadState("networkidle");

    const field = page.getByRole("combobox", { name: "Escreva um comentário" });
    await field.click();
    await field.pressSequentially("Olha só @Gabr", { delay: 20 });
    const suggestions = page.getByRole("listbox", { name: "Pessoas para mencionar" });
    await expect(suggestions.getByRole("option", { name: "Gabriel Rocha" })).toBeVisible();
    await expectAccessible(page);
    await field.press("Enter");
    await expect(field).toHaveValue("Olha só @Gabriel Rocha ");
    await field.pressSequentially("vale a pena se inscrever!");
    await page.getByRole("button", { name: "Comentar" }).click();
    const comment = page.getByRole("article", { name: "Comentário de Rafael Lima" }).filter({ hasText: "vale a pena se inscrever!" });
    await expect(comment.getByText("@Gabriel Rocha")).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, "gabriel.rocha@aurora.example");
    await gotoHydrated(page, "/notificacoes?aba=mencoes");
    const mention = page.getByRole("article", { name: /Você recebeu uma menção/ }).filter({ hasText: "vale a pena se inscrever!" });
    await expect(mention).toContainText("Rafael Lima");
    await mention.getByRole("link", { name: /Ver comentário/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Inscrições abertas para a Escola de Líderes" })).toBeVisible();
    await expect(page.getByRole("article", { name: "Comentário de Rafael Lima" }).filter({ hasText: "vale a pena se inscrever!" })).toHaveAttribute("aria-current", "true");
  });

  test("central no celular @mobile", async ({ page }) => {
    await signIn(page, "camila.oliveira@aurora.example");
    await gotoHydrated(page, "/notificacoes");
    await expect(page.getByRole("heading", { level: 1, name: "Notificações" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expectAccessible(page);
  });
});
