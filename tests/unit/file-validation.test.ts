import { describe, expect, it } from "vitest";
import { detectFileType, sanitizeFileName, validateUpload } from "@/server/files/validate";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const PDF = new TextEncoder().encode("%PDF-1.7\n...");
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const HTML = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");

describe("detecção de tipo por magic bytes", () => {
  it("reconhece PNG, JPEG, WEBP e PDF", () => {
    expect(detectFileType(PNG)?.mime).toBe("image/png");
    expect(detectFileType(JPEG)?.mime).toBe("image/jpeg");
    expect(detectFileType(WEBP)?.mime).toBe("image/webp");
    expect(detectFileType(PDF)?.mime).toBe("application/pdf");
  });
  it("não reconhece SVG nem HTML, mesmo que o nome diga .png", () => {
    expect(detectFileType(SVG)).toBeNull();
    expect(detectFileType(HTML)).toBeNull();
  });
});

describe("validateUpload", () => {
  it("avatar aceita imagem e recusa PDF", () => {
    expect(validateUpload("avatar", PNG).ok).toBe(true);
    expect(validateUpload("avatar", PDF)).toMatchObject({ ok: false });
  });
  it("material de aula aceita PDF", () => {
    expect(validateUpload("lesson_material", PDF).ok).toBe(true);
  });
  it("recusa SVG, vazio e acima do limite", () => {
    expect(validateUpload("course_cover", SVG).ok).toBe(false);
    expect(validateUpload("course_cover", new Uint8Array()).ok).toBe(false);
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(PNG);
    expect(validateUpload("avatar", big)).toMatchObject({ ok: false });
  });
});

describe("sanitizeFileName", () => {
  it("remove caminhos e caracteres perigosos e usa a extensão detectada", () => {
    expect(sanitizeFileName("../../etc/passwd.png", "png")).toBe("passwd.png");
    expect(sanitizeFileName('foto"<script>.exe', "jpg")).toBe("fotoscript.jpg");
    expect(sanitizeFileName("", "pdf")).toBe("arquivo.pdf");
  });
});

import { toEmbedUrl } from "@/server/modules/courses/video";

describe("toEmbedUrl — vídeos das aulas", () => {
  it("converte YouTube (sem cookies) e Vimeo", () => {
    expect(toEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(toEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(toEmbedUrl("https://vimeo.com/76979871")).toBe("https://player.vimeo.com/video/76979871");
  });
  it("recusa http, outros domínios e ids malformados", () => {
    expect(toEmbedUrl("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(toEmbedUrl("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(toEmbedUrl("https://youtube.com/watch?v=<script>")).toBeNull();
    expect(toEmbedUrl("javascript:alert(1)")).toBeNull();
  });
});
