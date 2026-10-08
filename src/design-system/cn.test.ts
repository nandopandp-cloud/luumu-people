import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn()", () => {
  it("mantém tamanho tipográfico do tema e cor juntos", () => {
    expect(cn("text-body-sm", "text-purple-600")).toBe("text-body-sm text-purple-600");
    expect(cn("text-h1 text-orange-700")).toBe("text-h1 text-orange-700");
  });
  it("resolve conflitos dentro do mesmo grupo", () => {
    expect(cn("text-h1", "text-h2")).toBe("text-h2");
    expect(cn("text-purple-600", "text-white")).toBe("text-white");
  });
});
