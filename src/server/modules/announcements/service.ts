import "server-only";
import { and, desc, eq, lte } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";

/** Mural do colaborador: comunicados publicados (segmentação por público: próxima etapa). */
export async function listAnnouncementFeed(actor: AuthenticatedActor, limit = 3) {
  return withTenant(actor, (tx) =>
    tx
      .select({
        id: s.announcements.id,
        title: s.announcements.title,
        summary: s.announcements.summary,
        category: s.announcements.category,
        theme: s.announcements.theme,
        illustration: s.announcements.illustration,
        publishedAt: s.announcements.publishedAt,
      })
      .from(s.announcements)
      .where(and(eq(s.announcements.status, "published"), lte(s.announcements.publishedAt, new Date())))
      .orderBy(desc(s.announcements.publishedAt))
      .limit(limit),
  );
}
