import "server-only";
import { randomBytes } from "node:crypto";
import { sendEmail } from "@/server/email/mailer";
import { inviteEmail } from "@/server/email/templates/invite";
import { env } from "@/server/env";
import { getAuth } from "./auth";

/**
 * Convite de acesso. O token é o MESMO mecanismo da redefinição de senha do
 * Better Auth (verificação `reset-password:<token>`, guardada com hash e de uso
 * único), só que com validade de 7 dias. A pessoa cria a senha em /convite e o
 * hook `onPasswordReset` ativa quem ainda estava "convidado".
 */
export const INVITE_TTL_DAYS = 7;

async function createInviteToken(userId: string): Promise<string> {
  const auth = await getAuth();
  const ctx = await auth.$context;
  const token = randomBytes(24).toString("base64url");
  await ctx.internalAdapter.createVerificationValue({
    value: userId,
    identifier: `reset-password:${token}`,
    expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  return token;
}

export async function sendInvite(user: { id: string; name: string; email: string }, organizationName: string, invitedBy: string) {
  const token = await createInviteToken(user.id);
  const { APP_URL } = env();
  const url = `${APP_URL}/convite?token=${encodeURIComponent(token)}`;
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const message = inviteEmail({ name: user.name, inviterName: invitedBy, organizationName, url, expiresAt, assetBase: APP_URL });
  await sendEmail({ to: user.email, ...message });
}
