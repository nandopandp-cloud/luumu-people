import type { Database } from "../client";
import * as s from "../schema";
import { todayInBrazil } from "@/lib/moods";

/**
 * Dados de EXEMPLO do sentimento do dia: quase todo mundo já respondeu hoje
 * (o modal não aparece nos testes), com alguns comentários. Ficam sem resposta
 * a Sofia (exemplo do modal diário) e o Lucas ("Sem registro hoje" no time da Carla).
 */
const EXAMPLES: Record<string, { mood: number; note?: string }> = {
  fernando: { mood: 5, note: "Dia produtivo e animado para os próximos desafios!" },
  carla: { mood: 6, note: "Time entregou o lançamento! 🚀" },
  camila: { mood: 6 },
  gabriel: { mood: 4 },
  helena: { mood: 3, note: "Semana puxada, mas seguimos firmes." },
  rafael: { mood: 4 },
  juliana: { mood: 3 },
  paula: { mood: 5 },
  natalia: { mood: 2 },
};
const CYCLE = [5, 6, 5, 4, 5, 3, 6, 5, 4, 2, 5, 6];
const PENDING = new Set(["sofia", "lucas"]);

export async function seedMoods(db: Database, tenantId: string, users: Map<string, { id: string }>) {
  const day = todayInBrazil();
  const rows = [...users.entries()]
    .filter(([key]) => !PENDING.has(key))
    .map(([key, user], i) => {
      const example = EXAMPLES[key];
      return { tenantId, userId: user.id, checkinDate: day, mood: example?.mood ?? CYCLE[i % CYCLE.length]!, note: example?.note ?? null };
    });
  if (rows.length) await db.insert(s.moodCheckins).values(rows).onConflictDoNothing();
}
