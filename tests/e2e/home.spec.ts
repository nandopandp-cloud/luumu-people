import { expect, test } from "@playwright/test";
import { expectAccessible, signIn } from "./helpers";

test.describe("Início do colaborador", () => {
  test("sem o módulo de cursos, mostra o desenvolvimento e é acessível", async ({ page }) => {
    await signIn(page, "camila.oliveira@aurora.example");
    await expect(page.getByRole("heading", { name: "Comunicados para você" })).toBeVisible();
    // "Meu desenvolvimento" no lugar das metas: anel, ciclo e ações por situação.
    await expect(page.getByRole("heading", { name: "Metas do meu PDI" })).toHaveCount(0);
    const development = page.getByRole("region", { name: "Meu desenvolvimento" });
    await expect(development.getByRole("heading", { name: /^PDI \d{4}$/ })).toBeVisible();
    await expect(development.getByText(/\d+ de \d+ ações concluídas/)).toBeVisible();
    await expect(development.getByText("Em andamento")).toBeVisible();
    await expect(development.getByRole("link", { name: /Ver meu PDI/ })).toHaveAttribute("href", "/desenvolvimento?aba=pdi");
    await expect(page.getByRole("heading", { name: "Minhas próximas atividades" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Meus cursos" })).toHaveCount(0);
    await expectAccessible(page);
  });

  test("com o módulo de cursos, mostra trilhas e progresso de aprendizagem", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await expect(page.getByRole("heading", { name: "Pequenos aprendizados constroem grandes futuros." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Comunicados para você" })).toBeVisible();
    await expect(page.getByText("Nova política de trabalho híbrido")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Desenvolvimento de Liderança" })).toBeVisible();
    await expect(page.getByText("4 de 9")).toBeVisible();
    await expect(page.getByText("Comunicação Não Violenta").first()).toBeVisible();
    await expectAccessible(page);
  });

  test("sentimento do dia: modal no primeiro acesso, agradecimento e o sentimento na jornada", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "sofia.ramos@aurora.example");
    const modal = page.getByRole("dialog", { name: "Como você está se sentindo hoje?" });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("radio")).toHaveCount(6);
    await expectAccessible(page);

    await modal.getByRole("radio", { name: "Bem", exact: true }).check();
    const note = modal.getByRole("textbox", { name: "Quer compartilhar algo? (opcional)" });
    await note.fill("Começando a semana bem ");
    // Emoji no comentário: busca e Enter inserem no cursor.
    await modal.getByRole("button", { name: "Inserir emoji" }).click();
    await page.getByRole("searchbox", { name: "Buscar emoji" }).fill("joinha");
    await page.getByRole("searchbox", { name: "Buscar emoji" }).press("Enter");
    await expect(note).toHaveValue("Começando a semana bem 👍");
    await expect(modal.getByText("25/300")).toBeVisible(); // o emoji conta 2 (como no servidor)
    await modal.getByRole("button", { name: "Enviar" }).click();

    const thanks = page.getByRole("dialog", { name: "Obrigado por compartilhar" });
    await expect(thanks).toBeVisible();
    await thanks.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Saudação personalizada com o sentimento; não reabre ao recarregar.
    await expect(page.getByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite), Sofia!/ })).toBeVisible();
    const greetingChip = page.getByRole("main").getByRole("button", { name: /^Hoje você está se sentindo bem!/ });
    await expect(greetingChip).toBeVisible();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Topo: hover mostra horário e comentário.
    await page.getByRole("banner").getByRole("button", { name: /^Hoje você está se sentindo bem!/ }).hover();
    await expect(page.getByRole("tooltip")).toContainText("Registrado às");
    await expect(page.getByRole("tooltip")).toContainText("Começando a semana bem 👍");

    // Mudar ao longo do dia: o chip reabre o modal já com a escolha atual.
    await greetingChip.click();
    await expect(modal.getByRole("radio", { name: "Bem", exact: true })).toBeChecked();
    await modal.getByRole("radio", { name: "Muito bem", exact: true }).check();
    await modal.getByRole("button", { name: "Enviar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("main").getByRole("button", { name: /^Hoje você está se sentindo muito bem!/ })).toBeVisible();

    // Perfil.
    await page.getByRole("button", { name: /^Menu da conta de / }).click();
    await page.getByRole("menuitem", { name: "Meu perfil" }).click();
    await expect(page.getByRole("main").getByRole("button", { name: /^Hoje você está se sentindo muito bem!/ }).first()).toBeVisible();
  });

  test("fechar sem responder: o modal não volta no mesmo dia e o topo convida a registrar", async ({ page }) => {
    await signIn(page, "lucas.ferreira@aurora.example");
    const modal = page.getByRole("dialog", { name: "Como você está se sentindo hoje?" });
    await expect(modal).toBeVisible();
    const dismissed = page.waitForResponse((r) => r.url().endsWith("/api/v1/me/mood/dismiss") && r.ok());
    await modal.getByRole("button", { name: "Fechar" }).click();
    await dismissed;
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("banner").getByRole("button", { name: "Como você está se sentindo hoje? Registrar" }).click();
    await expect(modal).toBeVisible();
  });

  test("gestora vê o sentimento de hoje do time direto", async ({ page }) => {
    await signIn(page, "carla.mendes@aurora.example");
    const team = page.getByRole("list", { name: /^Meu time/ });
    await expect(page.getByRole("heading", { name: "Meu time (5)" })).toBeVisible();
    await expect(team.getByRole("listitem").filter({ hasText: "Fernando Santos" })).toContainText("Bem");
    await expect(team.getByRole("listitem").filter({ hasText: "Lucas Ferreira" })).toContainText("Sem registro hoje");
    await expectAccessible(page);
  });

  test("sentimento no celular @mobile", async ({ page }) => {
    await signIn(page, "camila.oliveira@aurora.example");
    await page.getByRole("banner").getByRole("button", { name: /^Hoje você está se sentindo/ }).click();
    const modal = page.getByRole("dialog", { name: "Como você está se sentindo hoje?" });
    await expect(modal).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expectAccessible(page);
  });
});
