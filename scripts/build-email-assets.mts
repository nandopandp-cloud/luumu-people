/**
 * Gera as imagens dos e-mails transacionais em public/email/ (PNG @2x).
 * E-mail não exibe SVG no Gmail/Outlook, então a marca e os ícones viram PNG.
 *
 *   pnpm tsx scripts/build-email-assets.mts
 *
 * Rode de novo só quando a marca, os ícones ou a ilustração mudarem.
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge, Lock, Megaphone, Package, Star, UsersRound } from "lucide-react";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public/email");
await mkdir(out, { recursive: true });

const svg = (file: string) => readFile(path.join(root, "public/brand", file), "utf8");
const dataUri = async (file: string, type: string) => `data:${type};base64,${(await readFile(path.join(root, file))).toString("base64")}`;
const icon = (Icon: ComponentType<{ size?: number; strokeWidth?: number; color?: string }>, color: string, size = 26) => renderToStaticMarkup(createElement(Icon, { size, strokeWidth: 2, color }));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });

async function shot(name: string, html: string, { transparent = true }: { transparent?: boolean } = {}) {
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent"><div id="a" style="display:inline-block">${html}</div></body></html>`);
  await page.locator("#a").screenshot({ path: path.join(out, name), omitBackground: transparent });
  console.info(`public/email/${name}`);
}

// Marca
await shot("logo.png", `<div style="width:188px">${(await svg("wordmark.svg")).replace("<svg ", '<svg style="width:100%;height:auto;display:block" ')}</div>`);
await shot("mascot.png", `<div style="width:56px">${(await svg("mascot.svg")).replace("<svg ", '<svg style="width:100%;height:auto;display:block" ')}</div>`);

// Destaque: a ilustração oficial do e-mail (scripts/email-assets/hero-source.png,
// 1994×789) em duas fatias. A esquerda (só fundo) vira fundo da célula do texto;
// a direita (mascote e pessoa) é uma <img> comum — aparece em qualquer cliente.
// Recorte: x 215→1994 (o começo é só fundo liso). Divisão em x = 1000.
const source = await dataUri("scripts/email-assets/hero-source.png", "image/png");
// Escala para o cartão de 568 px (600 do e-mail − 2 × 16 de margem).
const HERO = (() => {
  const from = 215, split = 1000, to = 1994, card = 568;
  const scale = card / (to - from);
  return { from, split, to, scale, height: Math.round(789 * scale) };
})();
async function slice(name: string, x0: number, x1: number) {
  const width = Math.round((x1 - x0) * HERO.scale);
  await page.setContent(
    `<!doctype html><body style="margin:0"><div id="a" style="width:${width}px;height:${HERO.height}px;background:url('${source}') -${Math.round(x0 * HERO.scale)}px 0/auto ${HERO.height}px no-repeat"></div></body>`,
  );
  await page.locator("#a").screenshot({ path: path.join(out, name), type: "jpeg", quality: 88 });
  console.info(`public/email/${name} (${width}×${HERO.height})`);
}
await slice("hero-left.jpg", HERO.from, HERO.split);
await slice("hero-right.jpg", HERO.split, HERO.to);

// Folhas lilás do rodapé (decoração à direita do cartão).
const softLeaf = (x: number, y: number, r: number, s: number, c: string) =>
  `<svg width="${34 * s}" height="${44 * s}" viewBox="0 0 34 44" style="position:absolute;left:${x}px;top:${y}px;transform:rotate(${r}deg)"><path d="M17 2C5 12 2 26 10 38c2 3 6 4 9 2C31 30 32 14 17 2Z" fill="${c}"/></svg>`;
await shot(
  "footer-leaves.png",
  `<div style="position:relative;width:130px;height:76px;background:#F3EFFE;overflow:hidden;border-radius:0 20px 20px 0">
    ${softLeaf(8, 14, 38, 1, "#E2D8FD")}${softLeaf(52, 6, 28, 1.5, "#DCD0FD")}${softLeaf(96, 22, 20, 1.3, "#E6DDFE")}
  </div>`,
  { transparent: false },
);

// Ícones das funcionalidades (blocos arredondados) e o cadeado da ativação.
const tile = (inner: string, bg: string, size = 56, radius = 14) =>
  `<div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${bg};display:flex;align-items:center;justify-content:center">${inner}</div>`;
await shot("icon-comunicados.png", tile(icon(Package, "#6D28D9"), "#EDE9FE"));
await shot("icon-colegas.png", tile(icon(UsersRound, "#BE185D"), "#FCE7F3"));
await shot("icon-pesquisas.png", tile(icon(Megaphone, "#15803D"), "#DCFCE7"));
// Selo com estrela (como na referência): dois ícones sobrepostos.
await shot(
  "icon-desenvolvimento.png",
  tile(`<div style="position:relative;width:28px;height:28px">${icon(Badge, "#1D4ED8", 28)}<div style="position:absolute;left:8px;top:8px">${renderToStaticMarkup(createElement(Star, { size: 12, strokeWidth: 2.4, color: "#1D4ED8" }))}</div></div>`, "#DBEAFE"),
);
await shot("icon-cadeado.png", tile(icon(Lock, "#6D28D9", 30), "#EDE9FE", 72, 36));

await browser.close();
