/**
 * Modelos de perguntas oferecidos no builder (texto de produto, não dados).
 * A pessoa pode editar tudo antes de lançar.
 */
export type TemplateQuestion = { type: "scale" | "enps" | "choice" | "text"; text: string; options?: string[]; required: boolean };

const ENPS_QUESTION: TemplateQuestion = { type: "enps", text: "Em uma escala de 0 a 10, o quanto você recomendaria a empresa como um bom lugar para trabalhar?", required: true };

export const SURVEY_TEMPLATES: Record<"climate" | "enps" | "pulse", TemplateQuestion[]> = {
  climate: [
    { type: "scale", text: "Tenho clareza sobre o que se espera do meu trabalho.", required: true },
    { type: "scale", text: "Minha liderança me dá feedbacks que me ajudam a crescer.", required: true },
    { type: "scale", text: "Sinto que posso ser eu mesmo(a) no trabalho.", required: true },
    { type: "scale", text: "Tenho as ferramentas e os recursos de que preciso.", required: true },
    { type: "scale", text: "Consigo equilibrar trabalho e vida pessoal.", required: true },
    ENPS_QUESTION,
    { type: "text", text: "O que podemos fazer para melhorar a sua experiência?", required: false },
  ],
  enps: [ENPS_QUESTION, { type: "text", text: "Quer contar o motivo da sua nota?", required: false }],
  pulse: [
    { type: "scale", text: "Minha carga de trabalho está adequada.", required: true },
    { type: "scale", text: "Tenho energia para as minhas atividades da semana.", required: true },
    { type: "text", text: "Algo mais que queira compartilhar?", required: false },
  ],
};
