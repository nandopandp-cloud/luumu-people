import { describe, expect, it } from "vitest";
import { parseInline, parseRichText, stripRichText } from "@/lib/rich-text";

describe("formatação de comunicados", () => {
  it("texto puro antigo continua igual: parágrafos e quebras de linha", () => {
    expect(parseRichText("Primeiro.\n\nSegundo\ncom quebra.")).toEqual([
      { type: "p", lines: [[{ type: "text", value: "Primeiro." }]] },
      { type: "p", lines: [[{ type: "text", value: "Segundo" }], [{ type: "text", value: "com quebra." }]] },
    ]);
  });

  it("títulos, listas e marcação inline (inclusive aninhada)", () => {
    const blocks = parseRichText("## Diretrizes\nNesta comunicação:\n- **Dias** presenciais\n- *Remoto* e __flexível__\n\n1. Um\n2. Dois");
    expect(blocks.map((b) => b.type)).toEqual(["h2", "p", "ul", "ol"]);
    expect(blocks[2]).toEqual({
      type: "ul",
      items: [
        [{ type: "strong", children: [{ type: "text", value: "Dias" }] }, { type: "text", value: " presenciais" }],
        [{ type: "em", children: [{ type: "text", value: "Remoto" }] }, { type: "text", value: " e " }, { type: "u", children: [{ type: "text", value: "flexível" }] }],
      ],
    });
    expect(parseInline("**[FAQ](/comunicados)**")).toEqual([{ type: "strong", children: [{ type: "link", href: "/comunicados", children: [{ type: "text", value: "FAQ" }] }] }]);
  });

  it("links só com destino seguro; o resto vira texto", () => {
    expect(parseInline("[ok](https://exemplo.com/a)")).toEqual([{ type: "link", href: "https://exemplo.com/a", children: [{ type: "text", value: "ok" }] }]);
    for (const bad of ["javascript:alert(1)", "http://exemplo.com", "//evil.example", "data:text/html,x"]) {
      expect(parseInline(`[x](${bad})`), bad).toEqual([{ type: "text", value: `[x](${bad})` }]);
    }
  });

  it("HTML digitado é só texto", () => {
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([{ type: "text", value: "<img src=x onerror=alert(1)>" }]);
  });

  it("remove a marcação para contagem e resumo", () => {
    expect(stripRichText("## Título\n- **um** [link](https://a.b)\n1. *dois*")).toBe("Título\num link\ndois");
  });
});
