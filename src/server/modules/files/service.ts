import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import type { Permission } from "@/server/authz/permissions";
import { hasPermissionAnywhere } from "@/server/authz/policy";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import { storage as resolveStorage, StorageNotConfiguredError } from "@/server/files/storage";
import { sanitizeFileName, validateUpload, type FilePurpose } from "@/server/files/validate";
import { badRequest, forbidden, HttpError, notFound } from "@/server/http/errors";

type Meta = { ip: string | null; userAgent: string | null; requestId: string };

/** Quem pode ENVIAR cada tipo de arquivo. Avatar: o próprio usuário (se a empresa permitir). */
const UPLOAD_PERMISSION: Record<Exclude<FilePurpose, "avatar">, Permission> = {
  course_cover: "content.course.edit",
  lesson_material: "content.course.edit",
  announcement_cover: "comms.announcement.create",
  library_material: "content.library.manage",
};

function storage() {
  try {
    return resolveStorage();
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      throw new HttpError(503, "Envio de arquivos indisponível", "O armazenamento de arquivos ainda não foi configurado. Fale com o administrador da plataforma.");
    }
    throw error;
  }
}

export function fileUrl(id: string) {
  return `/api/v1/files/${id}`;
}

async function assertCanUpload(actor: AuthenticatedActor, purpose: FilePurpose) {
  if (purpose === "avatar") {
    const allowed = await withTenant(actor, async (tx) => {
      const [policy] = await tx
        .select({ editable: s.profileFieldPolicies.editableByEmployee })
        .from(s.profileFieldPolicies)
        .where(eq(s.profileFieldPolicies.fieldKey, "image"));
      return policy?.editable ?? false;
    });
    if (!allowed) throw forbidden("Sua empresa não permite alterar a foto do perfil.");
    return;
  }
  if (!hasPermissionAnywhere(actor, UPLOAD_PERMISSION[purpose])) throw forbidden();
}

export async function uploadFile(actor: AuthenticatedActor, purpose: FilePurpose, file: File, meta: Meta) {
  await assertCanUpload(actor, purpose);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateUpload(purpose, bytes);
  if (!validation.ok) throw badRequest(validation.message);

  const id = randomUUID();
  const storageKey = `${actor.tenantId}/${purpose}/${id}.${validation.type.extension}`;
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await storage().put(storageKey, bytes, validation.type.mime);

  try {
    await withTenant(actor, async (tx) => {
      await tx.insert(s.files).values({
        id,
        tenantId: actor.tenantId,
        ownerUserId: actor.userId,
        purpose,
        storageKey,
        originalName: sanitizeFileName(file.name, validation.type.extension),
        mimeType: validation.type.mime,
        sizeBytes: bytes.byteLength,
        sha256,
      });
      await recordAudit(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "file.uploaded",
        resourceType: "file",
        resourceId: id,
        metadata: { purpose, mime: validation.type.mime, size: bytes.byteLength },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      });
    });
  } catch (error) {
    // Sem registro no banco o arquivo ficaria órfão no storage.
    await storage().delete(storageKey).catch(() => undefined);
    throw error;
  }
  return { id, url: fileUrl(id), mimeType: validation.type.mime, sizeBytes: bytes.byteLength };
}

/**
 * Leitura: qualquer pessoa ATIVA do mesmo tenant pode ver avatares, capas e
 * materiais (conteúdo interno da empresa). Arquivos de outro tenant são
 * invisíveis pela RLS (404). Quando houver documentos restritos, a regra por
 * finalidade entra aqui.
 */
export async function openFile(actor: AuthenticatedActor, id: string) {
  const row = await withTenant(actor, async (tx) => {
    const [found] = await tx
      .select({ storageKey: s.files.storageKey, mimeType: s.files.mimeType, originalName: s.files.originalName, sizeBytes: s.files.sizeBytes, sha256: s.files.sha256 })
      .from(s.files)
      .where(and(eq(s.files.id, id), isNull(s.files.deletedAt)));
    return found;
  });
  if (!row) throw notFound();
  const object = await storage().get(row.storageKey);
  if (!object) throw notFound();
  return { ...row, body: object.body };
}

/** Define a foto do próprio perfil a partir de um upload do tipo avatar feito pela própria pessoa. */
export async function setMyAvatar(actor: AuthenticatedActor, file: File, meta: Meta) {
  const uploaded = await uploadFile(actor, "avatar", file, meta);
  await withTenant(actor, async (tx) => {
    await tx.update(s.users).set({ image: uploaded.url }).where(eq(s.users.id, actor.userId));
    await recordAudit(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: "people.profile_updated",
      resourceType: "user",
      resourceId: actor.userId,
      metadata: { fields: ["image"] },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
  });
  return uploaded;
}
