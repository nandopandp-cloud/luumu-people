"use client";

import { Tabs as RadixTabs } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../cn";

/** Abas em pílulas (padrão dos mockups: "Todas · Conquistas · Selos…"). */
export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof RadixTabs.List>) {
  return <RadixTabs.List className={cn("flex flex-wrap gap-2", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-neutral-100/80 px-5 text-body-sm font-medium text-neutral-600 transition-colors hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-[0_6px_16px_-6px_rgb(124_58_237/0.55)]",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = RadixTabs.Content;
