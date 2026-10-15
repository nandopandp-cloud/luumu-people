import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated, signIn } from "./helpers";

test.describe("Pesquisas", () => {
  test("colaborador responde a pesquisa de clima de forma anônima", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/pesquisas");
    await expect(page.getByRole("heading", { level: 1, name: "Sua opinião importa!" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pesquisa em andamento 1" })).toBeVisible();
    const card = page.getByRole("article", { name: "Pesquisa de Clima 2026" });
    await expect(card.getByText("Tempo estimado: 3 min")).toBeVisible();
    await expect(card.getByText("100% anônima")).toBeVisible();
    await expect(card.getByRole("progressbar", { name: /Prazo da pesquisa: \d+ dias? restantes?|Encerra hoje/ })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Responder pesquisa" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Pesquisa de Clima 2026" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Sua resposta é anônima. Evite inserir informações que possam identificar você ou outra pessoa.").first()).toBeVisible();
    await expectAccessible(page);

    // Enviar incompleto aponta o que falta.
    await page.getByRole("button", { name: "Enviar respostas" }).click();
    await expect(page.getByText("Faltam 7 perguntas obrigatórias.")).toBeVisible();

    const groups = page.getByRole("group");
    for (let i = 0; i < 5; i++) await groups.nth(i).getByText("4", { exact: true }).click();
    await groups.nth(5).getByRole("radio", { name: "9" }).check({ force: true });
    await groups.nth(6).getByText("Aprendizado").click();
    await page.getByLabel(/O que podemos fazer/).fill("Mais rituais de feedback.");
    await page.getByRole("button", { name: "Enviar respostas" }).click();
    await expect(page.getByRole("heading", { name: "Obrigado por participar!" })).toBeVisible();

    await gotoHydrated(page, "/pesquisas");
    await expect(page.getByRole("heading", { name: "Pesquisas em andamento 0" })).toBeVisible();
    const answered = page.getByRole("region", { name: /Pesquisas? respondidas? \d/ });
    const row = answered.getByRole("link", { name: /Pesquisa de Clima 2026/ });
    await expect(row).toContainText("Respondida em");
    await expect(row).toContainText("Respondida");
    await expectAccessible(page);
  });

  test("G&G vê resultados agregados, segmentados sem expor grupos pequenos", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "paula.ribeiro@aurora.example");
    await gotoHydrated(page, "/gestao/pesquisas");
    await expect(page.getByRole("heading", { level: 1, name: "Pesquisas" })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Pesquisa de Clima 2026" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Pesquisa de Clima 2026" })).toBeVisible();
    await expect(page.getByText("média de 1 a 5").first()).toBeVisible();
    await expect(page.getByText(/eNPS \(de −100 a 100\)/)).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Por diretoria" }).click();
    await expect(page.getByRole("list", { name: "Grupos de Diretoria" })).toBeVisible();
    await expect(page.getByText(/Grupos com poucas respostas são reunidos em “Outros”/)).toBeVisible();
  });

  test("gestão: duplicar, lançar, editar, pausar, retomar, encerrar e excluir", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, "paula.ribeiro@aurora.example");
    await gotoHydrated(page, "/gestao/pesquisas");
    // Duplicar a pesquisa de clima vira um rascunho novo.
    await page.getByRole("button", { name: "Ações da pesquisa Pesquisa de Clima 2026" }).click();
    await page.getByRole("menuitem", { name: "Duplicar" }).click();
    await page.waitForURL(/\/gestao\/pesquisas\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Editar pesquisa" })).toBeVisible();
    await expect(page.getByLabel("Título", { exact: true }).filter({ visible: true })).toHaveValue("Pesquisa de Clima 2026 (cópia)");
    await page.getByLabel("Título", { exact: true }).filter({ visible: true }).fill("Clima de teste E2E");
    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(page.getByText("Rascunho salvo").first()).toBeVisible();

    // Lançar.
    await page.getByRole("button", { name: "Lançar pesquisa" }).click();
    const launch = page.getByRole("dialog", { name: "Lançar pesquisa" });
    await expect(launch.getByText(/pessoas serão convidadas/)).toBeVisible();
    await launch.getByLabel("Recebe respostas até").click();
    await page.getByRole("button", { name: "Próximo mês" }).click();
    await page.getByRole("grid").getByRole("button").filter({ hasText: /^15$/ }).first().click();
    await launch.getByRole("button", { name: "Lançar agora" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Clima de teste E2E" })).toBeVisible();

    // Editar informações (perguntas congeladas).
    await page.getByRole("button", { name: "Ações da pesquisa Clima de teste E2E" }).click();
    await page.getByRole("menuitem", { name: "Editar informações" }).click();
    const edit = page.getByRole("dialog", { name: "Editar informações" });
    await edit.getByLabel("Título").fill("Clima E2E");
    await expectAccessible(page);
    await edit.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Clima E2E" })).toBeVisible();

    // Pausar e retomar.
    await page.getByRole("button", { name: "Pausar" }).click();
    await expect(page.getByText("Pausada", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Retomar" }).click();
    await page.getByRole("dialog", { name: "Retomar respostas" }).getByRole("button", { name: "Retomar" }).click();
    await expect(page.getByText("Em andamento", { exact: true }).first()).toBeVisible();

    // Encerrar e excluir (com confirmação forte).
    await page.getByRole("button", { name: "Encerrar", exact: true }).click();
    await page.getByRole("dialog", { name: "Encerrar pesquisa?" }).getByRole("button", { name: "Encerrar agora" }).click();
    await expect(page.getByText("Encerrada", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Ações da pesquisa Clima E2E" }).click();
    await page.getByRole("menuitem", { name: "Excluir" }).click();
    const remove = page.getByRole("dialog", { name: "Excluir pesquisa e respostas?" });
    await expect(remove.getByRole("button", { name: "Excluir" })).toBeDisabled();
    await remove.getByLabel("Digite EXCLUIR para confirmar").fill("excluir");
    await remove.getByRole("button", { name: "Excluir" }).click();
    await page.waitForURL(/\/gestao\/pesquisas$/);
    await expect(page.getByRole("link", { name: "Clima E2E" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Pesquisa de Clima 2026" })).toBeVisible();
  });

  test("builder: rascunho a partir de modelo", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "juliana.mendes@aurora.example");
    await gotoHydrated(page, "/gestao/pesquisas/nova");
    await page.getByLabel("Título", { exact: true }).fill("Pulso de onboarding");
    page.once("dialog", (dialog) => dialog.accept()); // substituir as perguntas do modelo inicial
    await page.getByRole("button", { name: "Pulso", exact: true }).click();
    await expect(page.getByLabel("Texto da pergunta 1")).toHaveValue("Minha carga de trabalho está adequada.");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await page.waitForURL(/\/gestao\/pesquisas\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Editar pesquisa" })).toBeVisible();
    // A página anterior (nova) continua montada, oculta, após a navegação.
    await expect(page.getByLabel("Título", { exact: true }).filter({ visible: true })).toHaveValue("Pulso de onboarding");
  });

  test("pesquisas no celular @mobile", async ({ page }) => {
    await signIn(page, "natalia.cunha@aurora.example");
    await gotoHydrated(page, "/pesquisas");
    await expect(page.getByRole("heading", { level: 1, name: "Sua opinião importa!" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Responder pesquisa/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expectAccessible(page);
  });

  test("lista da gestão: indicadores, abas, busca, ordenação, exportação e agendamento", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, "paula.ribeiro@aurora.example");
    await gotoHydrated(page, "/gestao/pesquisas");
    const kpis = page.getByRole("region", { name: "Indicadores" });
    for (const label of ["Total de pesquisas", "Participações totais", "Taxa média de participação", "eNPS médio"]) await expect(kpis.getByText(label)).toBeVisible();
    await expectAccessible(page);

    // Abas e situação "Agendada".
    await page.getByRole("link", { name: /^Agendadas \(\d+\)$/ }).click();
    await expect(page).toHaveURL(/status=agendadas/);
    const scheduledRow = page.getByRole("row").filter({ hasText: "eNPS — 2º semestre de 2026" });
    await expect(scheduledRow.getByText("Agendada")).toBeVisible();
    await page.getByRole("link", { name: /^Todas \(\d+\)$/ }).click();

    // Busca, tipo e ordenação.
    await page.getByRole("searchbox", { name: "Buscar por nome da pesquisa" }).fill("pulso");
    await expect(page).toHaveURL(/q=pulso/);
    await expect(page.getByRole("row").filter({ hasText: "Pesquisa de Clima 2026" })).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Buscar por nome da pesquisa" }).fill("");
    await page.getByRole("combobox", { name: "Tipo" }).selectOption("enps");
    await expect(page).toHaveURL(/tipo=enps/);
    await page.getByRole("link", { name: /^Período/ }).click();
    await expect(page.getByRole("columnheader", { name: /Período/ })).toHaveAttribute("aria-sort", "ascending");

    // Seleção → exportar participação.
    await page.getByRole("table").getByRole("row").nth(1).getByRole("checkbox").click();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Exportar participação" }).click();
    expect((await download).suggestedFilename()).toMatch(/^pesquisas-participacao-.*\.csv$/);

    // Nova pesquisa agendada para uma área.
    await gotoHydrated(page, "/gestao/pesquisas/nova");
    await page.getByLabel("Título", { exact: true }).fill("Pulso agendado E2E");
    await page.getByRole("button", { name: "Lançar pesquisa" }).click();
    const launch = page.getByRole("dialog", { name: "Lançar pesquisa" });
    await launch.getByLabel("Público").selectOption({ label: "Toda a empresa" });
    await launch.getByRole("radio", { name: "Agendar o início" }).click();
    await launch.getByLabel("Abre em").click();
    await page.getByRole("button", { name: "Próximo mês" }).click();
    await page.getByRole("grid").getByRole("button").filter({ hasText: /^10$/ }).first().click();
    await launch.getByLabel("Recebe respostas até").click();
    await page.getByRole("button", { name: "Próximo mês" }).click();
    await page.getByRole("grid").getByRole("button").filter({ hasText: /^20$/ }).first().click();
    await expect(launch.getByText(/Abre em \d{2}\/\d{2}\/\d{4} e recebe respostas até/)).toBeVisible();
    await launch.getByRole("button", { name: "Agendar pesquisa" }).click();
    await expect(page.getByText("Pesquisa agendada").first()).toBeVisible();
    await gotoHydrated(page, "/gestao/pesquisas?status=agendadas");
    await expect(page.getByRole("row").filter({ hasText: "Pulso agendado E2E" }).getByText("Agendada")).toBeVisible();
  });
});
