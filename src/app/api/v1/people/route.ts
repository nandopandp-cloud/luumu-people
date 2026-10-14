import { defineRoute } from "@/server/http/route";
import { SENSITIVE_RATE_LIMIT } from "@/server/http/rate-limit";
import { createPerson } from "@/server/modules/people/admin";
import { peopleQuerySchema, personCreateSchema } from "@/server/modules/people/schemas";
import { listPeople } from "@/server/modules/people/service";

/** Diretório de pessoas — limitado ao escopo de people.directory.read do ator. */
export const GET = defineRoute({
  permission: "people.directory.read",
  query: peopleQuerySchema,
  handler: ({ actor, query }) => listPeople(actor, query),
});

/** Cadastra um colaborador (nasce "convidado") e, por padrão, envia o convite de acesso. */
export const POST = defineRoute({
  permission: "people.manage",
  body: personCreateSchema,
  rateLimit: SENSITIVE_RATE_LIMIT,
  async handler({ actor, body, meta }) {
    return Response.json(await createPerson(actor, body, meta), { status: 201 });
  },
});
