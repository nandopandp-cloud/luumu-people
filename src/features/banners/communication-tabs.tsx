import type { Route } from "next";
import { LinkTabs } from "@/design-system/components/link-tabs";
import type { AuthenticatedActor } from "@/server/auth/session";
import { hasTenantWide } from "@/server/authz/policy";

type Section = "comunicados" | "banners" | "eventos" | "links";

const SECTIONS: { value: Section; label: string; href: Route; permission: Parameters<typeof hasTenantWide>[1] }[] = [
  { value: "comunicados", label: "Comunicados", href: "/gestao/comunicacao" as Route, permission: "comms.announcement.create" },
  { value: "banners", label: "Banners da home", href: "/gestao/comunicacao/banners" as Route, permission: "comms.announcement.publish" },
  { value: "eventos", label: "Eventos", href: "/gestao/comunicacao/eventos" as Route, permission: "comms.event.manage" },
  { value: "links", label: "Links rápidos", href: "/gestao/comunicacao/links" as Route, permission: "comms.quicklink.manage" },
];

/** Abas do módulo Comunicação: cada seção aparece só para quem tem a permissão dela. */
export function CommunicationTabs({ current, actor }: { current: Section; actor: AuthenticatedActor }) {
  const items = SECTIONS.filter((s) => hasTenantWide(actor, s.permission));
  if (items.length < 2) return null;
  return (
    <div className="mb-5">
      <LinkTabs label="Seções de comunicação" current={current} items={items.map(({ value, label, href }) => ({ value, label, href }))} />
    </div>
  );
}
