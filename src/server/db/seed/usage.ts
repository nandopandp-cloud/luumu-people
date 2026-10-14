import type { Database } from "../client";
import * as s from "../schema";
import { todayInBrazil } from "@/lib/moods";

/**
 * Dados de EXEMPLO do uso da plataforma (dashboard de gestão): 60 dias de
 * acessos com menos movimento no fim de semana. Determinístico (sem Math.random)
 * para os testes verem sempre os mesmos números.
 */
const DAYS = 60;

/** Pseudoaleatório estável a partir de dois inteiros (0 ≤ x < 1). */
const noise = (a: number, b: number) => {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export async function seedUsage(db: Database, tenantId: string, users: Map<string, { id: string }>) {
  const today = new Date(`${todayInBrazil()}T12:00:00Z`);
  const people = [...users.values()];
  const rows: (typeof s.usageDays.$inferInsert)[] = [];
  for (let back = DAYS - 1; back >= 0; back--) {
    const date = new Date(today.getTime() - back * 86_400_000);
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const day = date.toISOString().slice(0, 10);
    people.forEach((person, i) => {
      if (noise(back, i) > (weekend ? 0.25 : 0.85)) return;
      const visits = 1 + Math.floor(noise(i, back) * 4);
      const minutes = 4 + Math.floor(noise(back + 7, i + 3) * 22);
      rows.push({ tenantId, userId: person.id, day, visits, activeSeconds: minutes * 60, lastSeenAt: new Date(`${day}T18:00:00Z`) });
    });
  }
  if (rows.length) await db.insert(s.usageDays).values(rows).onConflictDoNothing();
}
