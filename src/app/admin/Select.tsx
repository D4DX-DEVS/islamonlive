"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { Icon } from "./icons";
import { iconProps } from "./ui";

export type SelectOption = { value: string; label: string };

type SelectProps = {
  /** must match one option; Radix reserves "", so give "no filter" a value such as "all" */
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** the accessible name, for selects without a visible label */
  label: string;
  className?: string;
};

/**
 * The admin's dropdown: a Radix select styled like the admin inputs, keyboard and screen-reader ready.
 * Its list is portalled to <body>, so it sits above the admin shell (z-100) with the other admin menus (z-150).
 */
export function Select({ value, options, onChange, label, className = "" }: SelectProps) {
  return <RadixSelect.Root value={value} onValueChange={onChange}>
    <RadixSelect.Trigger aria-label={label} className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-left text-sm text-slate-900 shadow-sm transition hover:border-violet-300 focus-visible:border-violet-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 data-[state=open]:border-violet-500 ${className}`}>
      <span className="min-w-0 truncate"><RadixSelect.Value /></span>
      <RadixSelect.Icon><Icon name="chevronDown" className="h-4 w-4 shrink-0 text-slate-500" /></RadixSelect.Icon>
    </RadixSelect.Trigger>
    <RadixSelect.Portal>
      <RadixSelect.Content position="popper" sideOffset={6} collisionPadding={12}
        className="z-[150] max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-violet-950/10">
        <RadixSelect.ScrollUpButton className="flex h-7 items-center justify-center text-slate-500"><Icon name="chevronDown" className="h-4 w-4 rotate-180" /></RadixSelect.ScrollUpButton>
        <RadixSelect.Viewport className="p-1">
          {options.map((option) => <RadixSelect.Item key={option.value} value={option.value}
            className="relative flex min-h-10 cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm text-slate-700 outline-none data-[highlighted]:bg-violet-50 data-[highlighted]:text-violet-900 data-[state=checked]:font-semibold data-[state=checked]:text-violet-800">
            <RadixSelect.ItemIndicator className="absolute left-2.5 inline-flex"><svg {...iconProps} className="h-4 w-4"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></RadixSelect.ItemIndicator>
            <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
          </RadixSelect.Item>)}
        </RadixSelect.Viewport>
        <RadixSelect.ScrollDownButton className="flex h-7 items-center justify-center text-slate-500"><Icon name="chevronDown" className="h-4 w-4" /></RadixSelect.ScrollDownButton>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  </RadixSelect.Root>;
}
