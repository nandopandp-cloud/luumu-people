import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { JOB_LEVEL_NAMES, type JobLevelName } from "../src/lib/job-catalog";

/**
 * Converte o organograma (CSV com NOME, ÁREA, CARGO, HIERARQUIA, GESTOR,
 * E-MAIL) no JSON do scripts/import-structure.mts.
 *
 *   pnpm tsx scripts/org-from-spreadsheet.mts organograma.csv --tenant jovens-genios --hire-date 2026-10-15 --out /fora/do/repo/estrutura.json
 *
 * - Cada ÁREA vira uma área raiz; cada CARGO, um cargo (gerencial se a pessoa tem equipe).
 * - Nível: só quando o cargo deixa claro (Jr/Pl/Sr, Estagiário, Coordenador, Gerente, C-level/Head).
 * - Quem tem pessoas abaixo recebe o papel Gestor.
 * - Linhas sem e-mail válido ficam de fora (e são listadas).
 * Nunca coloque o CSV nem o JSON no repositório: contêm dados pessoais.
 */
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { tenant: { type: "string" }, "hire-date": { type: "string" }, out: { type: "string" } },
});
const csvPath = positionals[0];
if (!csvPath || !values.tenant || !values["hire-date"] || !values.out) {
  console.error("Uso: <arquivo.csv> --tenant <slug> --hire-date aaaa-mm-dd --out <saida.json>");
  process.exit(1);
}
if (path.resolve(values.out).startsWith(path.resolve(import.meta.dirname, ".."))) {
  console.error("Por segurança, o JSON (com dados pessoais) não pode ficar dentro do repositório.");
  process.exit(1);
}

/** CSV simples com aspas (RFC 4180). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const LOWER = new Set(["da", "das", "de", "do", "dos", "e"]);
/** "ALICE PERLIN DA SILVA" → "Alice Perlin da Silva". */
const titleCase = (name: string) =>
  name
    .trim()
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((w, i) => (i > 0 && LOWER.has(w) ? w : w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1)))
    .join(" ");
const key = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Nível só quando o cargo deixa claro; senão, sem nível. */
function levelOf(position: string): JobLevelName | undefined {
  const p = ` ${position.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()} `;
  if (/estagiari/.test(p)) return "Estagiário";
  if (/\bchief\b|\bhead\b|\bdiretor/.test(p)) return "Liderança";
  if (/\bgerente\b/.test(p)) return "Gerente";
  if (/\bcoordenador/.test(p)) return "Coordenador";
  if (/\b(sr|senior)\b/.test(p)) return "Sênior";
  if (/\b(pl|pleno)\b/.test(p)) return "Pleno";
  if (/\b(jr|junior)\b/.test(p)) return "Júnior";
  return undefined;
}

const [header, ...lines] = parseCsv(readFileSync(csvPath, "utf8"));
const col = (name: string) => header!.findIndex((h) => key(h) === name);
const idx = { name: col("NOME"), area: col("ÁREA"), position: col("CARGO"), manager: col("GESTOR"), email: col("E-MAIL") };
if (Object.values(idx).some((i) => i < 0)) throw new Error(`Colunas esperadas: NOME, ÁREA, CARGO, GESTOR, E-MAIL. Encontradas: ${header!.join(", ")}`);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const all = lines.map((r) => ({
  name: r[idx.name]!.trim(),
  area: r[idx.area]!.trim(),
  position: r[idx.position]!.trim(),
  manager: r[idx.manager]!.trim(),
  email: r[idx.email]!.trim().toLowerCase(),
}));
const skipped = all.filter((p) => !EMAIL.test(p.email));
const people = all.filter((p) => EMAIL.test(p.email));
const emailByName = new Map(people.map((p) => [key(p.name), p.email]));
const hasTeam = new Set(people.map((p) => key(p.manager)).filter((m) => emailByName.has(m)));

const unknownManagers = people.filter((p) => p.manager && p.manager !== "-" && !emailByName.has(key(p.manager)));
const result = {
  tenant: values.tenant,
  orgUnits: [...new Set(people.map((p) => p.area))].sort().map((name) => ({ code: slug(name), name, type: "directorate" as const })),
  positions: [...new Set(people.map((p) => p.position))].sort().map((name) => ({ name, managerial: people.some((p) => p.position === name && hasTeam.has(key(p.name))) })),
  levels: JOB_LEVEL_NAMES.map((name, i) => ({ name, rank: i + 1 })),
  people: people.map((p) => {
    const level = levelOf(p.position);
    const manager = emailByName.get(key(p.manager));
    return {
      name: titleCase(p.name),
      email: p.email,
      orgUnit: slug(p.area),
      position: p.position,
      ...(level ? { level } : {}),
      hireDate: values["hire-date"]!,
      ...(manager ? { manager } : {}),
      ...(hasTeam.has(key(p.name)) ? { roles: ["manager" as const] } : {}),
    };
  }),
};
writeFileSync(values.out, JSON.stringify(result, null, 2), { mode: 0o600 });

console.log(`✓ ${result.people.length} pessoas, ${result.orgUnits.length} áreas, ${result.positions.length} cargos → ${values.out}`);
console.log(`  Gestores (com equipe): ${hasTeam.size}. Sem nível definido pelo cargo: ${result.people.filter((p) => !("level" in p)).length}.`);
if (skipped.length) console.log(`  Fora (sem e-mail válido): ${skipped.map((p) => titleCase(p.name)).join(", ")}`);
if (unknownManagers.length) console.log(`  Gestor não encontrado na lista: ${unknownManagers.map((p) => `${titleCase(p.name)} → ${p.manager}`).join("; ")}`);
