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
import { Lock, Mail, Megaphone, ShieldCheck, UsersRound } from "lucide-react";

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

// Ilustração do destaque: a mesma cena do produto (hero do Desenvolvimento), sobre formas lilás.
const scene = await dataUri("public/images/development/hero-overview.webp", "image/webp");
const leaf = (x: number, y: number, r: number, s = 1) =>
  `<svg width="${34 * s}" height="${44 * s}" viewBox="0 0 34 44" style="position:absolute;left:${x}px;top:${y}px;transform:rotate(${r}deg)"><path d="M17 2C5 12 2 26 10 38c2 3 6 4 9 2C31 30 32 14 17 2Z" fill="#7BC74D"/><path d="M17 2c-6 12-6 25 0 38" stroke="#4E9A2C" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
await shot(
  "hero.png",
  `<div style="position:relative;width:300px;height:310px;background:#F3EFFE;overflow:hidden;border-radius:0 24px 24px 0">
    <div style="position:absolute;left:-40px;top:-60px;width:220px;height:220px;border-radius:50%;background:#E6DEFE"></div>
    <div style="position:absolute;inset:0;background:url('${scene}') -150px 0/auto 310px no-repeat;
      -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 22%);mask-image:linear-gradient(90deg,transparent 0,#000 22%)"></div>
    ${leaf(18, 16, -28, 0.8)}${leaf(262, 10, 22, 0.7)}
  </div>`,
  { transparent: false },
);

// Ícones das funcionalidades (blocos arredondados) e o cadeado da ativação.
const tile = (inner: string, bg: string, size = 56, radius = 14) =>
  `<div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${bg};display:flex;align-items:center;justify-content:center">${inner}</div>`;
await shot("icon-comunicados.png", tile(icon(Mail, "#6D28D9"), "#EDE9FE"));
await shot("icon-colegas.png", tile(icon(UsersRound, "#BE185D"), "#FCE7F3"));
await shot("icon-pesquisas.png", tile(icon(Megaphone, "#15803D"), "#DCFCE7"));
await shot("icon-desenvolvimento.png", tile(icon(ShieldCheck, "#1D4ED8"), "#DBEAFE"));
await shot("icon-cadeado.png", tile(icon(Lock, "#6D28D9", 30), "#EDE9FE", 72, 36));

await browser.close();
