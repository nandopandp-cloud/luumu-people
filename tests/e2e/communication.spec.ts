import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated, signIn } from "./helpers";

test.describe("Mural de comunicados", () => {
  test("colaborador: destaques, abas, agenda, links, curtida e comentário", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "gabriel.rocha@aurora.example");
    await gotoHydrated(page, "/comunicados");

    await expect(page.getByRole("heading", { level: 1, name: "Comunicados" })).toBeVisible();
    const featured = page.getByRole("region", { name: "Comunicados em destaque" });
    await expect(featured.getByRole("heading", { name: "Nova política de trabalho híbrido" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Comunicado da semana" })).toBeVisible();
    const events = page.getByRole("region", { name: "Próximos eventos" });
    await expect(events.getByRole("link", { name: /Roda de conversa: Saúde Mental/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Links rápidos" }).getByRole("link", { name: /Benefícios/ })).toHaveAttribute("target", "_blank");
    await expectAccessible(page);

    // "Minha área": Gabriel é de Growth (dentro de Produto).
    await page.getByRole("navigation", { name: "Recortes do mural" }).getByRole("link", { name: "Minha área" }).click();
    await expect(page).toHaveURL(/aba=minha-area/);
    await expect(page.getByRole("heading", { level: 3, name: "Planejamento do trimestre de Produto" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Minha área" })).toHaveAttribute("aria-current", "page");

    // Filtro por categoria na lateral.
    await gotoHydrated(page, "/comunicados");
    await page.getByLabel("Categoria").selectOption("bem_estar");
    await expect(page).toHaveURL(/categoria=bem_estar/);
    const row = page.locator("article").filter({ hasText: "Programa de Saúde Mental" });
    await expect(row).toBeVisible();
    await expect(page.getByRole("region", { name: "Comunicados em destaque" })).toHaveCount(0);

    // Curtir e descurtir (o número muda junto).
    const like = row.getByRole("button", { name: /^Curtir/ });
    const before = Number((await like.innerText()).trim());
    await like.click();
    const unlike = row.getByRole("button", { name: /^Descurtir/ });
    await expect(unlike).toHaveAttribute("aria-pressed", "true");
    await expect(unlike).toHaveText(String(before + 1));
    await unlike.click();
    await expect(row.getByRole("button", { name: /^Curtir/ })).toHaveText(String(before));

    // Detalhe: comentar e remover o próprio comentário.
    await row.getByRole("link", { name: "Programa de Saúde Mental" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Programa de Saúde Mental" })).toBeVisible();
    await page.getByLabel("Escreva um comentário").fill("Comentário do teste de interface");
    await page.getByRole("button", { name: "Comentar" }).click();
    const comments = page.getByRole("region", { name: /Comentários/ });
    await expect(comments.getByText("Comentário do teste de interface")).toBeVisible();
    await expectAccessible(page);
    page.once("dialog", (d) => d.accept());
    await comments.getByRole("listitem").filter({ hasText: "Comentário do teste de interface" }).getByRole("button", { name: "Remover comentário de Gabriel Rocha" }).click();
    await expect(comments.getByText("Comentário do teste de interface")).toHaveCount(0);

    // Agenda completa e detalhe do evento.
    await gotoHydrated(page, "/comunicados/eventos");
    await page.getByRole("link", { name: /Workshop de Produtividade/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Workshop de Produtividade" })).toBeVisible();
    await expect(page.getByRole("article").getByText("Presencial (Sede)", { exact: true })).toBeVisible();
    await expectAccessible(page);
  });

  test("vídeo anexado aparece incorporado no comunicado", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/comunicados");
    await page.getByRole("region", { name: "Comunicados em destaque" }).getByRole("button", { name: /Ir para o destaque 2/ }).click();
    await page.getByRole("link", { name: /Saiba mais sobre “Semana da Diversidade”/ }).click();
    await expect(page.locator('iframe[title="Vídeo: Convite da Semana da Diversidade"]')).toHaveAttribute("src", "https://player.vimeo.com/video/76979871");
  });

  test("gestão: evento e link rápido criados aparecem no mural", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "rafael.lima@aurora.example");
    await gotoHydrated(page, "/gestao/comunicacao/eventos");
    await expect(page.getByRole("heading", { level: 1, name: "Eventos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Links rápidos" })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Novo evento" }).click();
    await page.waitForURL("**/eventos/novo");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Título").fill("Encontro de boas-vindas");
    await page.getByLabel("Formato").selectOption("presencial");
    const start = new Date(Date.now() + 86_400_000);
    const local = `${start.toISOString().slice(0, 10)}T09:00`;
    await page.getByLabel("Início (horário de Brasília)").fill(local);
    await page.getByRole("button", { name: "Criar evento" }).click();
    await expect(page.getByText("Informe o local do evento.").first()).toBeVisible();
    await page.getByLabel("Local", { exact: true }).fill("Sede");
    await page.getByRole("button", { name: "Criar evento" }).click();
    await page.waitForURL("**/gestao/comunicacao/eventos");
    await expect(page.getByRole("link", { name: /Encontro de boas-vindas/ })).toBeVisible();

    await gotoHydrated(page, "/gestao/comunicacao/links");
    await page.getByRole("button", { name: "Novo link" }).click();
    const dialog = page.getByRole("dialog", { name: "Novo link rápido" });
    await dialog.getByLabel("Nome").fill("Holerite");
    await dialog.getByLabel("Destino").fill("https://rh.aurora.example/holerite");
    await dialog.getByLabel("Ícone").selectOption("wallet");
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("https://rh.aurora.example/holerite")).toBeVisible();

    await gotoHydrated(page, "/comunicados");
    await expect(page.getByRole("region", { name: "Próximos eventos" }).getByRole("link", { name: /Encontro de boas-vindas/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Links rápidos" }).getByRole("link", { name: /Holerite/ })).toBeVisible();
  });

  test("mural no celular @mobile", async ({ page }) => {
    await signIn(page, "fernando.santos@aurora.example");
    await gotoHydrated(page, "/comunicados");
    await expect(page.getByRole("heading", { level: 1, name: "Comunicados" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Próximos eventos" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expectAccessible(page);
  });
});
