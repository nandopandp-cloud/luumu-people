import { describe, expect, it } from "vitest";
import { inviteEmail } from "@/server/email/templates/invite";

const base = { name: "Camila Oliveira", inviterName: "Paula Ribeiro", organizationName: "Aurora", url: "https://app.luumu.com/convite?token=abc", expiresAt: new Date("2026-10-21T15:00:00Z"), assetBase: "https://app.luumu.com/" };

describe("e-mail de convite", () => {
  it("traz saudação, quem convidou, o link, a validade e as imagens hospedadas", () => {
    const { subject, html, text } = inviteEmail(base);
    expect(subject).toBe("Paula Ribeiro convidou você para a Luumu People");
    expect(html).toContain("Olá, Camila!");
    expect(html).toContain('href="https://app.luumu.com/convite?token=abc"');
    expect(html).toContain("válido até <strong");
    expect(html).toContain("21/10/2026");
    expect(html).toMatch(/src="https:\/\/app\.luumu\.com\/email\/logo\.png\?v=\w+"/);
    expect(html).not.toContain(".svg");
    expect(text).toContain(base.url);
    expect(text).toContain("21/10/2026");
  });

  it("escapa nomes vindos do cadastro (sem HTML injetado no e-mail)", () => {
    const { html } = inviteEmail({ ...base, name: "<b>Ana</b>", inviterName: 'Eve "<script>"', organizationName: "A&B" });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Ana");
    expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(html).toContain("Eve &quot;&lt;script&gt;&quot;");
  });
});
