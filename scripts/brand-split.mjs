// Gera as variações da marca a partir do SVG original (brand/luumu-people.svg).
// Não redesenha nada: apenas seleciona camadas (paths) e recorta o viewBox.
import { readFileSync, writeFileSync } from "node:fs";

const source = readFileSync(new URL("../brand/luumu-people.svg", import.meta.url), "utf8");
const paths = [...source.matchAll(/<path [^>]+\/>/g)].map((m) => m[0]);
if (paths.length !== 42) throw new Error(`Esperava 42 camadas, encontrei ${paths.length}`);

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const groups = {
  mascot: [...range(1, 17), 27, 28, 42],
  bubble: range(22, 25),
  wordmark: [...range(18, 21), 26, ...range(29, 41)],
};

/** Caixa delimitadora real: amostra as curvas cúbicas (pontos de controle não contam). */
function bbox(indices) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  const add = (x, y) => {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  };
  for (const i of indices) {
    const d = paths[i - 1].match(/d="([^"]+)"/)[1];
    let cx = 0, cy = 0;
    for (const [, cmd, args] of d.matchAll(/([MLCZ])([^MLCZ]*)/gi)) {
      const n = (args.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      if (cmd === "M" || cmd === "L") {
        for (let k = 0; k + 1 < n.length; k += 2) { cx = n[k]; cy = n[k + 1]; add(cx, cy); }
      } else if (cmd === "C") {
        for (let k = 0; k + 5 < n.length; k += 6) {
          const [ax, ay, bx, by, ex, ey] = n.slice(k, k + 6);
          for (let t = 0; t <= 1; t += 0.02) {
            const u = 1 - t;
            add(u ** 3 * cx + 3 * u * u * t * ax + 3 * u * t * t * bx + t ** 3 * ex, u ** 3 * cy + 3 * u * u * t * ay + 3 * u * t * t * by + t ** 3 * ey);
          }
          cx = ex; cy = ey;
        }
      }
    }
  }
  const pad = 4;
  return [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 - x0 + pad * 2), Math.ceil(y1 - y0 + pad * 2)];
}

function write(name, indices, title) {
  const order = [...indices].sort((a, b) => a - b); // preserva a ordem de empilhamento original
  const [x, y, w, h] = bbox(order);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}" fill="none" role="img" aria-label="${title}">\n${order.map((i) => paths[i - 1]).join("\n")}\n</svg>\n`;
  writeFileSync(new URL(`../public/brand/${name}.svg`, import.meta.url), svg);
  console.log(`${name}.svg  viewBox=${x} ${y} ${w} ${h}`);
}

write("logo", [...groups.mascot, ...groups.bubble, ...groups.wordmark], "Luumu People");
write("wordmark", groups.wordmark, "Luumu People");
write("mascot", groups.mascot, "Luumu, o mascote da Luumu People");
write("symbol", [...groups.mascot, ...groups.bubble], "Luumu People");
