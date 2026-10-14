/** Cargos e níveis aceitos no cadastro de colaborador (lista fixa, em ordem). */
export const POSITION_NAMES = ["Assistente", "Analista", "Coordenador", "Gerente"] as const;
export const JOB_LEVEL_NAMES = ["Estagiário", "Júnior", "Pleno", "Sênior", "Liderança", "Coordenador", "Gerente"] as const;
export type PositionName = (typeof POSITION_NAMES)[number];
export type JobLevelName = (typeof JOB_LEVEL_NAMES)[number];
/** Cargos de gestão (marcados como gerenciais no cadastro de cargos). */
export const MANAGERIAL_POSITIONS: readonly PositionName[] = ["Coordenador", "Gerente"];
