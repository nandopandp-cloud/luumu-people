import "server-only";
import { desc, eq } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";

export async function listMyAchievements(actor: AuthenticatedActor, limit = 4) {
  return withTenant(actor, (tx) =>
    tx
      .select({ id: s.achievements.id, name: s.achievements.name, icon: s.achievements.icon, theme: s.achievements.theme, earnedAt: s.userAchievements.earnedAt })
      .from(s.userAchievements)
      .innerJoin(s.achievements, eq(s.achievements.id, s.userAchievements.achievementId))
      .where(eq(s.userAchievements.userId, actor.userId))
      .orderBy(desc(s.userAchievements.earnedAt))
      .limit(limit),
  );
}
