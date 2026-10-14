import { describe, expect, it } from "vitest";
import { normalizeEmailFrom } from "@/server/email/mailer";

describe("EMAIL_FROM", () => {
  it("aceita os formatos do Resend e limpa aspas/espaços colados no painel", () => {
    expect(normalizeEmailFrom('  "Luumu People <nao-responda@mail.luumu.com.br>" ')).toBe("Luumu People <nao-responda@mail.luumu.com.br>");
    expect(normalizeEmailFrom("nao-responda@mail.luumu.com.br")).toBe("nao-responda@mail.luumu.com.br");
  });
  it("recusa formatos que o Resend rejeitaria", () => {
    expect(normalizeEmailFrom("Luumu People nao-responda@mail.luumu.com.br")).toBeNull();
    expect(normalizeEmailFrom("Luumu People <mail.luumu.com.br>")).toBeNull();
  });
});
