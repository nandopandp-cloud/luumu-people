import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";

export async function listFeaturedLibrary(actor: AuthenticatedActor, limit = 4) {
  return withTenant(actor, (tx) =>
    tx
      .select({ id: s.libraryItems.id, type: s.libraryItems.type, title: s.libraryItems.title, durationMinutes: s.libraryItems.durationMinutes })
      .from(s.libraryItems)
      .where(and(eq(s.libraryItems.status, "published"), eq(s.libraryItems.featured, true)))
      .orderBy(desc(s.libraryItems.publishedAt))
      .limit(limit),
  );
}
