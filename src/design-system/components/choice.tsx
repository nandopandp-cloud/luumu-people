"use client";

import { Check, Minus } from "lucide-react";
import { Checkbox as RadixCheckbox, RadioGroup as RadixRadio, Switch as RadixSwitch } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "../cn";

/** Switch, Checkbox e Radio — styleguide "07. Switch, checkbox e radio". */

export function Switch({ label, className, ...props }: ComponentProps<typeof RadixSwitch.Root> & { label: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <RadixSwitch.Root
        id={id}
        className="peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-neutral-200 transition-colors data-[state=checked]:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
        {...props}
      >
        <RadixSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[22px]" />
      </RadixSwitch.Root>
      <label htmlFor={id} className="text-body-sm text-neutral-700 peer-disabled:text-neutral-400">
        {label}
      </label>
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<typeof RadixCheckbox.Root> & { label: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <RadixCheckbox.Root
        id={id}
        className="peer flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2 border-neutral-300 bg-white transition-colors data-[state=checked]:border-purple-500 data-[state=checked]:bg-purple-500 data-[state=indeterminate]:border-purple-500 data-[state=indeterminate]:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
        {...props}
      >
        <RadixCheckbox.Indicator className="text-white">
          {props.checked === "indeterminate" ? <Minus className="size-3.5" strokeWidth={3} /> : <Check className="size-3.5" strokeWidth={3} />}
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <label htmlFor={id} className="text-body-sm text-neutral-700 peer-disabled:text-neutral-400">
        {label}
      </label>
    </div>
  );
}

export function RadioGroup({ options, className, ...props }: ComponentProps<typeof RadixRadio.Root> & { options: { value: string; label: ReactNode; disabled?: boolean }[] }) {
  const id = useId();
  return (
    <RadixRadio.Root className={cn("flex flex-col gap-2.5", className)} {...props}>
      {options.map((option) => (
        <div key={option.value} className="flex items-center gap-2.5">
          <RadixRadio.Item
            id={`${id}-${option.value}`}
            value={option.value}
            disabled={option.disabled}
            className="peer flex size-5 items-center justify-center rounded-full border-2 border-neutral-300 bg-white data-[state=checked]:border-purple-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
          >
            <RadixRadio.Indicator className="block size-2.5 rounded-full bg-purple-500" />
          </RadixRadio.Item>
          <label htmlFor={`${id}-${option.value}`} className="text-body-sm text-neutral-700 peer-disabled:text-neutral-400">
            {option.label}
          </label>
        </div>
      ))}
    </RadixRadio.Root>
  );
}
