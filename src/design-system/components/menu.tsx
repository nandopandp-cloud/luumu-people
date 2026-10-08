"use client";

import { DropdownMenu } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../cn";

/** Dropdown menu acessível (teclado, foco, ARIA) — Radix. */
export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ className, ...props }: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={8}
        align="end"
        className={cn("z-50 min-w-56 rounded-lg border border-line bg-white p-1.5 shadow-lg data-[state=open]:animate-in", className)}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

export function MenuItem({ className, ...props }: ComponentProps<typeof DropdownMenu.Item>) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-3 py-2 text-body-sm text-neutral-700 outline-none data-[highlighted]:bg-purple-50 data-[highlighted]:text-purple-600 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn("px-3 py-2 text-caption font-medium uppercase tracking-wide text-neutral-500", className)} {...props} />;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}
