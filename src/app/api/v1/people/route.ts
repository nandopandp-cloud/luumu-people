import { defineRoute } from "@/server/http/route";
import { peopleQuerySchema } from "@/server/modules/people/schemas";
import { listPeople } from "@/server/modules/people/service";

/** Diretório de pessoas — limitado ao escopo de people.directory.read do ator. */
export const GET = defineRoute({
  permission: "people.directory.read",
  query: peopleQuerySchema,
  handler: ({ actor, query }) => listPeople(actor, query),
});
