import path from "node:path";
import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated, signIn } from "./helpers";

test.describe("Desenvolvimento", () => {
  test("colaborador acompanha o PDI e conclui uma ação com evidência, sem lançar metas", async ({ page }) => {
    test.setTimeout(150_000);
    await signIn(page, "camila.oliveira@aurora.example");
    await gotoHydrated(page, "/desenvolvimento");
    await expect(page.getByRole("heading", { level: 1, name: /Seu crescimento/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Meus objetivos de desenvolvimento" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Progresso geral do PDI" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Conquistas recentes" })).toBeVisible();
    // Objetivo recolhível.
    const goalCard = page.getByRole("article", { name: "Desenvolver visão estratégica" });
    await goalCard.getByRole("button", { name: "Recolher Desenvolver visão estratégica" }).click();
    await expect(goalCard.getByText("Participar do planejamento trimestral")).toBeHidden();
    await goalCard.getByRole("button", { name: "Expandir Desenvolver visão estratégica" }).click();
    await expect(goalCard.getByText("Participar do planejamento trimestral")).toBeVisible();
    // Metas e ações são lançadas pela liderança.
    await expect(page.getByRole("button", { name: "Nova ação" })).toHaveCount(0);
    await expectAccessible(page);

    await gotoHydrated(page, "/desenvolvimento?aba=pdi");
    await expect(page.getByRole("heading", { level: 1, name: "Meu PDI" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Evoluir para posição de liderança" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Editar objetivo" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Novo objetivo" })).toHaveCount(0);
    await expectAccessible(page);
    // Passa pelos objetivos até o de visão estratégica.
    await page.getByRole("button", { name: "Próximo objetivo" }).click();
    await page.getByRole("button", { name: "Próximo objetivo" }).click();
    await expect(page.getByRole("heading", { name: "Desenvolver visão estratégica" })).toBeVisible();

    const plans = page.getByRole("list", { name: "Ações de Desenvolver visão estratégica" });
    const action = plans.getByRole("listitem").filter({ hasText: "Participar do planejamento trimestral" });
    await action.getByRole("button", { name: "Opções da ação Participar do planejamento trimestral" }).click();
    await page.getByRole("menuitem", { name: "Concluir" }).click();
    const done = page.getByRole("dialog", { name: "Concluir ação" });
    await done.getByLabel("Evidência (opcional)", { exact: true }).fill("Participei e apresentei os indicadores.");
    await done.getByRole("button", { name: "Concluir" }).click();
    await expect(done).toBeHidden();
    await expect(action.getByLabel("Concluída")).toBeVisible();
    await expect(action.getByText("Com evidência")).toBeVisible();
    // Filtro por situação.
    await page.getByRole("group", { name: "Filtrar ações por situação" }).getByRole("button", { name: /^Concluídos/ }).click();
    await expect(plans.getByRole("listitem").filter({ hasText: "Participar do planejamento trimestral" })).toBeVisible();
    await expect(plans.getByRole("listitem").filter({ hasText: "Participar do planejamento trimestral" }).getByRole("img", { name: "Não iniciada" })).toHaveCount(0);

    // Mentoria: "Agendar conversa" abre o chat flutuante com a pessoa mentora.
    const mentorship = page.getByRole("region", { name: "Minha mentoria" });
    await mentorship.getByRole("button", { name: /^Agendar conversa com/ }).click();
    await expect(page.getByRole("region", { name: "Conversas rápidas" }).getByRole("textbox", { name: "Mensagem" })).toBeVisible();

    await gotoHydrated(page, "/desenvolvimento?aba=conquistas");
    await expect(page.getByRole("heading", { name: "Meus níveis por competência" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Linha do tempo" }).getByRole("listitem").first()).toBeVisible();
    await expectAccessible(page);
  });

  test("competências e evolução são acessíveis e sem autoavaliação", async ({ page }) => {
    await signIn(page, "camila.oliveira@aurora.example");
    await gotoHydrated(page, "/desenvolvimento?aba=competencias");
    await expect(page.getByRole("img", { name: /^Comunicação: atual/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Autoavaliar|Avaliar/ })).toHaveCount(0);
    await expectAccessible(page);
    await gotoHydrated(page, "/desenvolvimento?aba=evolucao");
    await expect(page.getByText("Média das competências")).toBeVisible();
    await expectAccessible(page);
  });

  test("gestora vê o relatório da pessoa, lança meta e ação e avalia uma competência", async ({ page }) => {
    test.setTimeout(150_000);
    await signIn(page, "carla.mendes@aurora.example");
    await gotoHydrated(page, "/gestao/desenvolvimento");
    await expect(page.getByRole("heading", { name: "Lacunas de competências" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Buscar pessoa" }).fill("camila");
    const row = page.getByRole("row").filter({ hasText: "Camila Oliveira" });
    await expect(row).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Gabriel Rocha" })).toHaveCount(0);
    await expectAccessible(page);

    await row.getByRole("link", { name: "Ver desenvolvimento de Camila Oliveira" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Camila Oliveira" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Objetivos de desenvolvimento" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectAccessible(page);
    const base = new URL(page.url()).pathname;

    await gotoHydrated(page, `${base}?aba=pdi`);
    await page.getByRole("button", { name: "Novo objetivo" }).click();
    const goalDialog = page.getByRole("dialog", { name: "Nova meta de desenvolvimento" });
    await goalDialog.getByLabel("Objetivo").fill("Conduzir rituais do time");
    await goalDialog.getByLabel("Etiquetas (opcional)").fill("Rituais, Time");
    await goalDialog.getByRole("button", { name: "Adicionar meta" }).click();
    await expect(goalDialog).toBeHidden();
    // O novo objetivo é o último: avança até ele.
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Próximo objetivo" }).click();
    await expect(page.getByRole("heading", { name: "Conduzir rituais do time" })).toBeVisible();
    await expect(page.getByText("Rituais", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Nova ação" }).click();
    const actionDialog = page.getByRole("dialog", { name: "Nova ação" });
    await actionDialog.getByLabel("O que será feito?").fill("Facilitar a retrospectiva");
    await actionDialog.getByRole("button", { name: "Adicionar ação" }).click();
    await expect(actionDialog).toBeHidden();
    await expect(page.getByRole("list", { name: "Ações de Conduzir rituais do time" }).getByText("Facilitar a retrospectiva")).toBeVisible();

    // Editar o objetivo e definir a mentoria.
    await page.getByRole("button", { name: "Editar objetivo" }).click();
    const edit = page.getByRole("dialog", { name: "Editar objetivo" });
    await edit.getByLabel("Descrição (opcional)").fill("Facilitar as cerimônias do time com autonomia.");
    await edit.getByRole("button", { name: "Salvar" }).click();
    await expect(edit).toBeHidden();
    await expect(page.getByText("Facilitar as cerimônias do time com autonomia.")).toBeVisible();
    const mentorship = page.getByRole("region", { name: "Mentoria", exact: true });
    await mentorship.getByRole("button", { name: "Opções da mentoria" }).click();
    await page.getByRole("menuitem", { name: "Alterar mentoria" }).click();
    const mentorDialog = page.getByRole("dialog", { name: "Alterar mentoria" });
    await mentorDialog.getByRole("searchbox", { name: "Buscar colaboradores" }).fill("Juliana");
    await mentorDialog.getByRole("button", { name: /Juliana Mendes/ }).click();
    await mentorDialog.getByLabel("Mensagem para a pessoa (opcional)").fill("Conte comigo nos rituais!");
    await expectAccessible(page);
    await mentorDialog.getByRole("button", { name: "Salvar" }).click();
    await expect(mentorDialog).toBeHidden();
    await expect(mentorship.getByText("Juliana Mendes").first()).toBeVisible();
    await expect(mentorship.getByText("“Conte comigo nos rituais!”")).toBeVisible();

    await gotoHydrated(page, `${base}?aba=competencias`);
    const card = page.getByRole("listitem").filter({ hasText: "Gestão do Tempo" });
    await card.getByRole("button", { name: "Avaliar" }).click();
    const dialog = page.getByRole("dialog", { name: "Avaliar: Gestão do Tempo" });
    await dialog.getByRole("radio", { name: /Referência/ }).click();
    await dialog.getByRole("button", { name: "Registrar avaliação" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("img", { name: "Gestão do Tempo: atual 100%, esperado 70%" })).toBeVisible();

    await gotoHydrated(page, `${base}?aba=historico`);
    await expect(page.getByRole("cell", { name: "Gestão do Tempo" }).first()).toBeVisible();
    await expectAccessible(page);
  });

  test("relatórios: mapa de competências da equipe", async ({ page }) => {
    await signIn(page, "carla.mendes@aurora.example");
    await gotoHydrated(page, "/gestao/relatorios");
    await expect(page.getByRole("heading", { name: "Mapa de competências" })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: /Camila Oliveira/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Exportar CSV" })).toHaveCount(0);
    await expectAccessible(page);
  });
});

test.describe("Perfil", () => {
  test("foto com editor (zoom, rotação) e capa personalizada", async ({ page }) => {
    test.setTimeout(120_000);
    const image = path.join(process.cwd(), "public/images/login-scene.webp");
    await signIn(page, "gabriel.rocha@aurora.example");
    await gotoHydrated(page, "/meu-perfil");

    await page.getByRole("button", { name: "Trocar foto do perfil" }).locator("..").locator('input[type="file"]').setInputFiles(image);
    const editor = page.getByRole("dialog", { name: "Ajustar foto do perfil" });
    await expect(editor).toBeVisible();
    await editor.getByLabel("Zoom").fill("2");
    await editor.getByRole("button", { name: "Girar à direita" }).click();
    await expect(editor.getByText("90°")).toBeVisible();
    await expectAccessible(page);
    await editor.getByRole("button", { name: "Salvar" }).click();
    await expect(editor).toBeHidden();
    await expect(page.getByText("Foto atualizada!").first()).toBeVisible();

    await page.getByRole("button", { name: "Alterar capa" }).locator("..").locator('input[type="file"]').setInputFiles(image);
    const coverEditor = page.getByRole("dialog", { name: "Ajustar capa do perfil" });
    await coverEditor.getByRole("button", { name: "Salvar" }).click();
    await expect(coverEditor).toBeHidden();
    await expect(page.getByText("Capa atualizada!").first()).toBeVisible();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator('section img[src^="/api/v1/files/"]').first()).toBeVisible();
    await expectAccessible(page);
  });
});
