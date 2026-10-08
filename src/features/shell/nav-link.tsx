"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { cn } from "@/design-system/cn";
import { NAV_ICONS } from "./icons";
import type { NavItem } from "./nav-config";

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function NavLink({ item, nested }: { item: NavItem; nested?: boolean }) {
  const pathname = usePathname();
  const active = isActive(pathname, item);
  const Icon = NAV_ICONS[item.icon];
  return (
    <Link
      href={item.href as Route}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3.5 rounded-lg px-4 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
        nested ? "h-10 pl-12 text-body-sm" : "h-12 text-[15px]",
        active ? "bg-purple-100 font-semibold text-purple-600" : "text-neutral-700 hover:bg-purple-50 hover:text-purple-600",
      )}
    >
      {nested ? null : <Icon aria-hidden className={cn("size-[22px] shrink-0", active ? "text-purple-500" : "text-neutral-600 group-hover:text-purple-500")} strokeWidth={active ? 2.2 : 1.8} />}
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function MobileNavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isActive(pathname, item);
  const Icon = NAV_ICONS[item.icon];
  return (
    <Link
      href={item.href as Route}
      aria-current={active ? "page" : undefined}
      className={cn("flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium", active ? "text-purple-600" : "text-neutral-500")}
    >
      <Icon aria-hidden className="size-6" strokeWidth={active ? 2.2 : 1.8} />
      {item.label}
    </Link>
  );
}
