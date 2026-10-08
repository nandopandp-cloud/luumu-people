"use client";

import { ChevronsLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/design-system/cn";

const KEY = "luumu:sidebar";

/** Recolhe/expande a sidebar (desktop). Preferência salva neste navegador. */
export function SidebarToggle({ controls }: { controls: string }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com o estado aplicado por /sidebar-init.js
    setCollapsed(document.documentElement.dataset.sidebar === "collapsed");
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    if (next) document.documentElement.dataset.sidebar = "collapsed";
    else delete document.documentElement.dataset.sidebar;
    try {
      localStorage.setItem(KEY, next ? "collapsed" : "expanded");
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-controls={controls}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
      title={collapsed ? "Expandir menu" : "Recolher menu"}
      className="absolute -right-3.5 top-9 z-10 flex size-7 items-center justify-center rounded-full border border-line bg-white text-neutral-600 shadow-sm transition-colors hover:border-purple-200 hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
    >
      <ChevronsLeft aria-hidden className={cn("size-4 transition-transform duration-200", collapsed && "rotate-180")} />
    </button>
  );
}
