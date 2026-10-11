import { describe, expect, it } from "vitest";
import { encodeMentions, keepMentions, mentionedIds, mentionsToPlainText, mentionToken, splitMentions } from "@/lib/mentions";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("menções em comentários", () => {
  it("lê marcadores e texto", () => {
    const body = `${mentionToken("Fernando Santos", A)} o que acha? cc ${mentionToken("Ana", B)}`;
    expect(splitMentions(body)).toEqual([
      { type: "mention", name: "Fernando Santos", userId: A },
      { type: "text", value: " o que acha? cc " },
      { type: "mention", name: "Ana", userId: B },
    ]);
    expect(mentionedIds(`${body} ${mentionToken("Ana", B)}`)).toEqual([A, B]);
  });

  it("na tela usa o nome atual da pessoa, não o gravado no marcador", () => {
    const forged = `${mentionToken("Diretoria", A)} aprovou`;
    expect(mentionsToPlainText(forged, { [A]: "Fernando Santos" })).toBe("@Fernando Santos aprovou");
  });

  it("menção a quem não pode ser mencionado vira texto simples", () => {
    const body = `Oi ${mentionToken("Ana", A)} e ${mentionToken("Bia", B)}`;
    expect(keepMentions(body, new Set([B]))).toBe(`Oi @Ana e ${mentionToken("Bia", B)}`);
  });

  it("converte só as menções escolhidas na lista (nomes mais longos primeiro)", () => {
    const picked = new Map([
      ["Ana", A],
      ["Ana Paula", B],
    ]);
    expect(encodeMentions("Valeu @Ana Paula e @Ana! @Anabela não.", picked)).toBe(`Valeu ${mentionToken("Ana Paula", B)} e ${mentionToken("Ana", A)}! @Anabela não.`);
    expect(encodeMentions("sem menção", new Map())).toBe("sem menção");
  });

  it("o nome no marcador não quebra o formato", () => {
    expect(mentionToken("Nome [x](y)", A)).toBe(`@[Nome xy](user:${A})`);
  });
});
