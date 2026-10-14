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

// Ilustração do destaque (como na referência): cartão lilás com a pessoa ao fundo
// num arco que "sai" acima do cartão e o mascote na frente segurando um envelope.
// A pessoa e o mascote são os mesmos do produto (hero do Desenvolvimento e marca).
const scene = await dataUri("public/images/development/hero-overview.webp", "image/webp");
const mascot = (await svg("mascot.svg")).replace("<svg ", '<svg style="width:100%;height:auto;display:block" ');
const leaf = (x: number, y: number, r: number, s = 1) =>
  `<svg width="${34 * s}" height="${44 * s}" viewBox="0 0 34 44" style="position:absolute;left:${x}px;top:${y}px;transform:rotate(${r}deg)"><path d="M17 2C5 12 2 26 10 38c2 3 6 4 9 2C31 30 32 14 17 2Z" fill="#7BC74D"/><path d="M17 2c-6 12-6 25 0 38" stroke="#4E9A2C" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
const envelope = `<svg width="64" height="50" viewBox="0 0 64 50" style="position:absolute;left:112px;top:228px;transform:rotate(-12deg);filter:drop-shadow(0 4px 6px rgba(76,29,149,.25))">
  <rect x="2" y="2" width="60" height="46" rx="7" fill="#F5F1FF" stroke="#D9CCFB" stroke-width="2"/>
  <path d="M4 6l28 20L60 6" fill="none" stroke="#C9B8FA" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M32 40c-6-4.6-10-8-10-12a5 5 0 0 1 10-1.6A5 5 0 0 1 42 28c0 4-4 7.4-10 12Z" fill="#8B3FE0"/></svg>`;
const sparkles = `<svg width="40" height="40" viewBox="0 0 40 40" style="position:absolute;left:4px;top:158px"><g stroke="#FFC22E" stroke-width="4.5" stroke-linecap="round"><path d="M26 4l-2 9"/><path d="M8 12l7 6"/><path d="M4 30l9-1"/></g></svg>`;
await shot(
  "hero.png",
  `<div style="position:relative;width:300px;height:300px;background:transparent;overflow:hidden">
    <div style="position:absolute;left:0;top:40px;width:300px;height:260px;background:#F3EFFE;border-radius:0 24px 24px 0"></div>
    <div style="position:absolute;left:150px;top:180px;width:200px;height:200px;border-radius:50%;background:#E8DFFF"></div>
    <div style="position:absolute;left:96px;top:6px;width:204px;height:294px;border-radius:102px 102px 24px 0;overflow:hidden;background:#EDE6FF">
      <img src="${scene}" style="position:absolute;left:-380px;top:2px;width:770px;height:300px;transform:scaleX(-1)">
      <div style="position:absolute;inset:0;background:linear-gradient(90deg,#EDE6FF 0,rgba(237,230,255,.85) 14%,rgba(237,230,255,0) 34%)"></div>
    </div>
    <div style="position:absolute;left:14px;top:162px;width:126px">${mascot}</div>
    ${envelope}${sparkles}${leaf(60, 2, -28, 0.85)}${leaf(34, 92, 30, 0.6)}
  </div>`,
  { transparent: true },
);

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
