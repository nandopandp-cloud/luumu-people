import { expect, test } from "@playwright/test";
import { expectAccessible, gotoHydrated } from "./helpers";

test.describe("Design system", () => {
  test("vitrine é acessível e os componentes interativos funcionam", async ({ page }) => {
    await gotoHydrated(page, "/design-system");
    await expectAccessible(page);

    // Multiselect: remove um chip e adiciona outro pela busca + teclado.
    await page.getByRole("button", { name: "Remover Liderança" }).click();
    await page.getByLabel("Temas de interesse").click();
    await page.getByRole("searchbox", { name: "Buscar…" }).fill("comu");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Remover Comunicação" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remover Liderança" })).toHaveCount(0);

    // Date picker: abre, anda um dia com a seta e confirma com Enter.
    await page.getByLabel("Data de início").click();
    await expect(page.getByRole("grid")).toBeVisible();
    await expectAccessible(page);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Data de início")).toContainText("13/03/2026");

    // Toast anunciado.
    await page.getByRole("button", { name: "Toast de sucesso" }).click();
    await expect(page.getByText("Operação realizada com sucesso!")).toBeVisible();

    // Tabela: ordena por progresso (desc) e pagina.
    const progresso = page.getByRole("columnheader", { name: "Progresso" });
    await progresso.getByRole("button").click();
    await progresso.getByRole("button").click();
    await expect(progresso).toHaveAttribute("aria-sort", "descending");
    await page.getByRole("button", { name: "Próxima página" }).click();
    await expect(page.getByText("6–10 de 14")).toBeVisible();

    // Gráfico com alternância para tabela.
    await page.getByRole("button", { name: "Ver como tabela" }).first().click();
    await expect(page.getByRole("cell", { name: "16/09" })).toBeVisible();
  });
});
