import type { SystemRoleKey } from "@/server/authz/system-roles";
import type { OrgUnitType } from "../schema/organization";

/**
 * Dados demonstrativos — TODOS fictícios. Domínios `.example` são reservados
 * (RFC 2606) e não pertencem a ninguém.
 *
 * Única fonte de dados de demonstração do projeto: componentes e serviços nunca
 * devem conter dados fixos.
 */

export type SeedPerson = {
  key: string;
  name: string;
  orgUnit: string;
  position: string;
  level: string;
  businessUnit: string;
  manager?: string;
  hireDate: string;
  contract?: "clt" | "pj" | "intern";
  roles?: SystemRoleKey[];
  headline?: string;
};

export type SeedOrganization = {
  slug: string;
  name: string;
  emailDomain: string;
  anonymityK: 5 | 7 | 10;
  businessUnits: { code: string; name: string; city: string; state: string }[];
  orgUnits: { code: string; name: string; type: OrgUnitType; parent?: string }[];
  positions: { name: string; managerial?: boolean }[];
  levels: { name: string; rank: number }[];
  tags: string[];
  people: SeedPerson[];
};

const levels = [
  { name: "Estágio", rank: 1 },
  { name: "Júnior", rank: 2 },
  { name: "Pleno", rank: 3 },
  { name: "Sênior", rank: 4 },
  { name: "Especialista", rank: 5 },
  { name: "Liderança", rank: 6 },
];

type Row = [key: string, name: string, orgUnit: string, position: string, level: string, bu: string, manager: string | undefined, hireDate: string, roles?: SystemRoleKey[]];

const auroraPeople: Row[] = [
  ["marina", "Marina Costa", "pres", "CEO", "Liderança", "rj", undefined, "2015-03-02"],

  ["ricardo", "Ricardo Almeida", "tec", "Diretor(a)", "Liderança", "rj", "marina", "2016-08-15", ["manager"]],
  ["carla", "Carla Mendes", "prod", "Head", "Liderança", "rj", "ricardo", "2018-02-05", ["manager"]],
  ["fernando", "Fernando Santos", "growth", "Product Manager", "Pleno", "rj", "carla", "2022-03-12"],
  ["camila", "Camila Oliveira", "growth", "Product Manager", "Sênior", "rj", "carla", "2019-06-03"],
  ["gabriel", "Gabriel Rocha", "growth", "Analista de Produto", "Júnior", "remoto", "carla", "2024-01-15"],
  ["lucas", "Lucas Ferreira", "plat", "Product Manager", "Sênior", "rj", "carla", "2020-09-21"],
  ["helena", "Helena Duarte", "plat", "Analista de Produto", "Pleno", "sp", "carla", "2023-04-10"],
  ["thiago", "Thiago Nunes", "eng", "Gerente", "Liderança", "rj", "ricardo", "2017-11-13", ["manager"]],
  ["bruno", "Bruno Martins", "backend", "Engenheiro(a) de Software", "Sênior", "rj", "thiago", "2019-02-18"],
  ["isabela", "Isabela Freitas", "backend", "Engenheiro(a) de Software", "Pleno", "remoto", "thiago", "2021-07-05"],
  ["diego", "Diego Carvalho", "backend", "Engenheiro(a) de Software", "Pleno", "sp", "thiago", "2022-10-03"],
  ["leticia", "Letícia Barros", "backend", "Engenheiro(a) de Software", "Júnior", "rj", "thiago", "2024-05-06"],
  ["mateus", "Mateus Pires", "backend", "Estagiário(a)", "Estágio", "rj", "thiago", "2025-08-04"],
  ["amanda", "Amanda Teixeira", "frontend", "Engenheiro(a) de Software", "Sênior", "rj", "thiago", "2018-05-14"],
  ["vinicius", "Vinícius Lopes", "frontend", "Engenheiro(a) de Software", "Pleno", "remoto", "thiago", "2021-01-11"],
  ["beatriz", "Beatriz Cardoso", "frontend", "Engenheiro(a) de Software", "Júnior", "sp", "thiago", "2024-09-02"],
  ["pedro", "Pedro Henrique Moura", "frontend", "Engenheiro(a) de Software", "Pleno", "rj", "thiago", "2022-06-20"],
  // Área com 3 pessoas: abaixo do k padrão (5) — usada nos testes de anonimato.
  ["renata", "Renata Gomes", "dados", "Analista de Dados", "Sênior", "rj", "ricardo", "2019-10-07", ["manager"]],
  ["felipe", "Felipe Araújo", "dados", "Analista de Dados", "Pleno", "rj", "renata", "2022-02-14"],
  ["sofia", "Sofia Ramos", "dados", "Analista de Dados", "Júnior", "remoto", "renata", "2024-03-18"],
  ["rafael", "Rafael Lima", "design", "Designer", "Sênior", "rj", "ricardo", "2020-04-06", ["editor"]],
  ["larissa", "Larissa Melo", "design", "Designer", "Pleno", "sp", "ricardo", "2023-01-09"],

  ["patricia", "Patrícia Souza", "gg", "Diretor(a)", "Liderança", "rj", "marina", "2016-01-18", ["people"]],
  ["juliana", "Juliana Mendes", "dh", "Analista de Gente & Gestão", "Sênior", "rj", "patricia", "2019-08-12", ["people"]],
  ["eduardo", "Eduardo Castro", "dh", "Analista de Gente & Gestão", "Pleno", "rj", "patricia", "2022-11-07"],
  ["roberta", "Roberta Antunes", "dh", "Especialista em Educação Corporativa", "Especialista", "remoto", "patricia", "2020-03-16", ["editor"]],
  ["paula", "Paula Ribeiro", "dp", "Analista de Sistemas de RH", "Sênior", "rj", "patricia", "2018-09-24", ["admin"]],
  ["marcos", "Marcos Vieira", "dp", "Analista de Departamento Pessoal", "Pleno", "rj", "patricia", "2021-05-03"],
  ["tatiane", "Tatiane Rocha", "dp", "Analista de Departamento Pessoal", "Júnior", "rj", "patricia", "2024-02-19"],

  ["andre", "André Batista", "com", "Diretor(a)", "Liderança", "sp", "marina", "2017-04-10", ["manager"]],
  ["claudia", "Cláudia Fernandes", "vendas", "Gerente", "Liderança", "sp", "andre", "2018-07-02", ["manager"]],
  ["joao", "João Silva", "vendas", "Executivo(a) de Vendas", "Pleno", "sp", "claudia", "2022-08-15"],
  ["natalia", "Natália Cunha", "vendas", "Executivo(a) de Vendas", "Júnior", "sp", "claudia", "2024-06-03"],
  ["rodrigo", "Rodrigo Azevedo", "vendas", "Executivo(a) de Vendas", "Sênior", "sp", "claudia", "2019-03-25"],
  ["aline", "Aline Moreira", "vendas", "Executivo(a) de Vendas", "Pleno", "remoto", "claudia", "2021-10-18"],
  ["gustavo", "Gustavo Reis", "vendas", "Executivo(a) de Vendas", "Júnior", "sp", "claudia", "2025-01-13"],
  ["daniela", "Daniela Prado", "cs", "Coordenador(a)", "Liderança", "sp", "andre", "2019-01-07", ["manager"]],
  ["leonardo", "Leonardo Matos", "cs", "Analista de Customer Success", "Pleno", "sp", "daniela", "2021-03-08"],
  ["carolina", "Carolina Dias", "cs", "Analista de Customer Success", "Júnior", "remoto", "daniela", "2024-07-22"],
  ["henrique", "Henrique Barbosa", "cs", "Analista de Customer Success", "Sênior", "sp", "daniela", "2018-11-12"],
  ["priscila", "Priscila Lacerda", "cs", "Analista de Customer Success", "Pleno", "rj", "daniela", "2022-04-04"],

  ["fabio", "Fábio Monteiro", "ops", "Diretor(a)", "Liderança", "rj", "marina", "2016-06-06", ["manager"]],
  ["vanessa", "Vanessa Correia", "fin", "Coordenador(a)", "Liderança", "rj", "fabio", "2018-03-19", ["manager"]],
  ["otavio", "Otávio Ferraz", "fin", "Analista Financeiro", "Pleno", "rj", "vanessa", "2021-09-13"],
  ["simone", "Simone Batista", "fin", "Analista Financeiro", "Sênior", "rj", "vanessa", "2019-12-02"],
  ["caio", "Caio Mendonça", "fin", "Analista Financeiro", "Júnior", "remoto", "vanessa", "2024-10-07"],
  ["luiza", "Luíza Campos", "jur", "Advogado(a)", "Sênior", "rj", "fabio", "2020-07-27"],
];

const headlines: Record<string, string> = {
  fernando: "Aprendizado constante, pessoas incríveis e resultados que geram impacto.",
  carla: "Produto é sobre resolver o problema certo para as pessoas certas.",
  juliana: "Gente cresce quando encontra espaço para aprender.",
};

function toPeople(rows: Row[]): SeedPerson[] {
  return rows.map(([key, name, orgUnit, position, level, businessUnit, manager, hireDate, roles]) => ({
    key,
    name,
    orgUnit,
    position,
    level,
    businessUnit,
    manager,
    hireDate,
    roles,
    contract: position.startsWith("Estagiário") ? "intern" : "clt",
    headline: headlines[key],
  }));
}

export const aurora: SeedOrganization = {
  slug: "aurora",
  name: "Aurora Tecnologia",
  emailDomain: "aurora.example",
  anonymityK: 5,
  businessUnits: [
    { code: "rj", name: "Sede Rio de Janeiro", city: "Rio de Janeiro", state: "RJ" },
    { code: "sp", name: "Escritório São Paulo", city: "São Paulo", state: "SP" },
    { code: "remoto", name: "Remoto", city: "Remoto", state: "BR" },
  ],
  orgUnits: [
    { code: "pres", name: "Presidência", type: "directorate" },
    { code: "tec", name: "Tecnologia", type: "directorate" },
    { code: "prod", name: "Produto", type: "area", parent: "tec" },
    { code: "growth", name: "Growth", type: "subarea", parent: "prod" },
    { code: "plat", name: "Plataforma", type: "subarea", parent: "prod" },
    { code: "eng", name: "Engenharia", type: "area", parent: "tec" },
    { code: "backend", name: "Backend", type: "subarea", parent: "eng" },
    { code: "frontend", name: "Frontend", type: "subarea", parent: "eng" },
    { code: "dados", name: "Dados", type: "area", parent: "tec" },
    { code: "design", name: "Design", type: "area", parent: "tec" },
    { code: "gg", name: "Gente & Gestão", type: "directorate" },
    { code: "dh", name: "Desenvolvimento Humano", type: "area", parent: "gg" },
    { code: "dp", name: "Departamento Pessoal", type: "area", parent: "gg" },
    { code: "com", name: "Comercial", type: "directorate" },
    { code: "vendas", name: "Vendas", type: "area", parent: "com" },
    { code: "cs", name: "Customer Success", type: "area", parent: "com" },
    { code: "ops", name: "Operações & Finanças", type: "directorate" },
    { code: "fin", name: "Financeiro", type: "area", parent: "ops" },
    { code: "jur", name: "Jurídico", type: "area", parent: "ops" },
  ],
  positions: [
    { name: "CEO", managerial: true },
    { name: "Diretor(a)", managerial: true },
    { name: "Head", managerial: true },
    { name: "Gerente", managerial: true },
    { name: "Coordenador(a)", managerial: true },
    { name: "Product Manager" },
    { name: "Analista de Produto" },
    { name: "Engenheiro(a) de Software" },
    { name: "Estagiário(a)" },
    { name: "Analista de Dados" },
    { name: "Designer" },
    { name: "Analista de Gente & Gestão" },
    { name: "Especialista em Educação Corporativa" },
    { name: "Analista de Sistemas de RH" },
    { name: "Analista de Departamento Pessoal" },
    { name: "Executivo(a) de Vendas" },
    { name: "Analista de Customer Success" },
    { name: "Analista Financeiro" },
    { name: "Advogado(a)" },
  ],
  levels,
  tags: ["Liderança", "Onboarding 2025", "Embaixadores de Cultura"],
  people: toPeople(auroraPeople),
};

/** Segunda empresa — existe para demonstrar e testar o isolamento entre tenants. */
export const horizonte: SeedOrganization = {
  slug: "horizonte",
  name: "Horizonte Educação",
  emailDomain: "horizonte.example",
  anonymityK: 7,
  businessUnits: [{ code: "bh", name: "Sede Belo Horizonte", city: "Belo Horizonte", state: "MG" }],
  orgUnits: [
    { code: "geral", name: "Diretoria Geral", type: "directorate" },
    { code: "pedagogico", name: "Pedagógico", type: "area", parent: "geral" },
  ],
  positions: [{ name: "Diretor(a)", managerial: true }, { name: "Coordenador(a) Pedagógico(a)", managerial: true }, { name: "Professor(a)" }],
  levels,
  tags: [],
  people: toPeople([
    ["sergio", "Sérgio Tavares", "geral", "Diretor(a)", "Liderança", "bh", undefined, "2014-02-03", ["admin"]],
    ["elisa", "Elisa Moraes", "pedagogico", "Coordenador(a) Pedagógico(a)", "Liderança", "bh", "sergio", "2017-05-08", ["manager", "people"]],
    ["igor", "Igor Valente", "pedagogico", "Professor(a)", "Sênior", "bh", "elisa", "2019-03-11"],
    ["clara", "Clara Nascimento", "pedagogico", "Professor(a)", "Pleno", "bh", "elisa", "2021-08-02"],
    ["davi", "Davi Rezende", "pedagogico", "Professor(a)", "Júnior", "bh", "elisa", "2024-02-05"],
  ]),
};

export const SEED_ORGANIZATIONS = [aurora, horizonte];

export const SEED_FEATURE_FLAGS = [
  { key: "anonymous_surveys", description: "Pesquisas anônimas", defaultEnabled: true },
  { key: "gamification", description: "Conquistas, XP e níveis (oculto por enquanto)", defaultEnabled: false },
  { key: "achievements_ranking", description: "Ranking de conquistas entre colegas", defaultEnabled: false },
  { key: "mood_checkin", description: "Check-in de humor na página inicial", defaultEnabled: true },
  { key: "survey_ai_analysis", description: "Análise de comentários de pesquisas com IA", defaultEnabled: false },
  { key: "ai_assistant", description: "Assistente Luumu", defaultEnabled: false },
  { key: "new_learning_dashboard", description: "Novo painel de aprendizagem", defaultEnabled: false },
] as const;

/** Campos do perfil que o colaborador pode editar por padrão. */
export const DEFAULT_EDITABLE_PROFILE_FIELDS = ["preferredName", "phone", "headline", "image"] as const;

export function seedEmail(person: Pick<SeedPerson, "name">, domain: string): string {
  const parts = person.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/);
  return `${parts[0]}.${parts.at(-1)}@${domain}`;
}
