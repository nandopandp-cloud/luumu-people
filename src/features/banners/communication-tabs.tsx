import type { Route } from "next";
import { LinkTabs } from "@/design-system/components/link-tabs";

/** Abas do módulo Comunicação. Banners só para quem publica. */
export function CommunicationTabs({ current, canManageBanners }: { current: "comunicados" | "banners"; canManageBanners: boolean }) {
  if (!canManageBanners) return null;
  return (
    <div className="mb-5">
      <LinkTabs
        label="Seções de comunicação"
        current={current}
        items={[
          { value: "comunicados", label: "Comunicados", href: "/gestao/comunicacao" as Route },
          { value: "banners", label: "Banners da home", href: "/gestao/comunicacao/banners" as Route },
        ]}
      />
    </div>
  );
}
