import { ALL_PERMISSIONS } from "@/server/authz/permissions";
import { hasPermissionAnywhere } from "@/server/authz/policy";
import { defineRoute } from "@/server/http/route";
import { effectiveFlags } from "@/server/modules/flags/service";
import { getOrganization } from "@/server/modules/organization/service";

/** O próprio usuário: identidade, empresa, papéis, permissões efetivas e flags. */
export const GET = defineRoute({
  permission: "authenticated",
  async handler({ actor }) {
    const [organization, flags] = await Promise.all([getOrganization(actor), effectiveFlags(actor)]);
    return {
      user: actor.user,
      organization,
      roles: actor.grants.map((g) => ({ key: g.roleKey, scope: g.scope })),
      permissions: ALL_PERMISSIONS.filter((p) => hasPermissionAnywhere(actor, p)),
      flags,
    };
  },
});
