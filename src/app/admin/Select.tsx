"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as RadixSelect from "@radix-ui/react-select";
import { Icon, type IconName } from "./icons";
import { iconProps } from "./ui";

/** `searchText` is extra text the search box also matches (an author's slug, say), never shown. */
export type SelectOption = { value: string; label: string; searchText?: string };

type SelectProps = {
  /** must match one option; "" is fine (it is mapped internally, as Radix reserves it) */
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** the accessible name, for selects without a visible label */
  label: string;
  className?: string;
  /** an icon at the start of the trigger */
  icon?: IconName;
  /** shown in the trigger instead of the selected option's label */
  display?: ReactNode;
  disabled?: boolean;
  title?: string;
  /** "field" looks like an admin input; "ghost" is a borderless toolbar button */
  variant?: "field" | "ghost";
  onOpenChange?: (open: boolean) => void;
};

/** Radix forbids "" as an item value, so "no filter" options travel under this one. */
const EMPTY = "__empty__";
const toRadix = (value: string) => (value === "" ? EMPTY : value);
const fromRadix = (value: string) => (value === EMPTY ? "" : value);

const triggerClass = {
  field: "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm hover:border-violet-300 focus-visible:border-violet-500 focus-visible:ring-4 focus-visible:ring-violet-100 data-[state=open]:border-violet-500 data-[state=open]:ring-4 data-[state=open]:ring-violet-100",
  ghost: "h-9 rounded-lg px-2.5 text-sm text-slate-800 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-violet-300 data-[state=open]:bg-slate-100",
};

/**
 * The admin's dropdown: a Radix select styled like the admin inputs, keyboard and screen-reader ready
 * (type a letter to jump to an option). Its list is portalled to <body>, so it sits above the admin
 * shell (z-100), the other admin menus (z-150) and the admin dialogs (z-200).
 */
export function Select(props: SelectProps) {
  // Radix mounts, registers and measures every item on open, which stalls on long lists (hundreds of authors)
  return props.options.length > SEARCH_AT ? <SearchSelect {...props} /> : <SmallSelect {...props} />;
}

function SmallSelect({ value, options, onChange, label, className = "", icon, display, disabled = false, title, variant = "field", onOpenChange }: SelectProps) {
  return <RadixSelect.Root value={toRadix(value)} onValueChange={(next) => onChange(fromRadix(next))} disabled={disabled} onOpenChange={onOpenChange}>
    <RadixSelect.Trigger aria-label={label} title={title} className={`group flex cursor-pointer items-center justify-between gap-2 text-left outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${triggerClass[variant]} ${className}`}>
      <span className="flex min-w-0 items-center gap-2.5">
        {icon && <Icon name={icon} className="h-[18px] w-[18px] shrink-0 text-slate-500" />}
        <span className="min-w-0 truncate">{display ?? <RadixSelect.Value />}</span>
      </span>
      <RadixSelect.Icon><Icon name="chevronDown" className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-data-[state=open]:rotate-180" /></RadixSelect.Icon>
    </RadixSelect.Trigger>
    <RadixSelect.Portal>
      <RadixSelect.Content position="popper" sideOffset={6} collisionPadding={12}
        className="z-[250] max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-violet-950/10">
        <RadixSelect.ScrollUpButton className="flex h-7 items-center justify-center text-slate-500"><Icon name="chevronDown" className="h-4 w-4 rotate-180" /></RadixSelect.ScrollUpButton>
        <RadixSelect.Viewport className="p-1">
          {options.map((option) => <RadixSelect.Item key={option.value} value={toRadix(option.value)}
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

/** Above this many options the dropdown gets a search box and renders only the first matches. */
const SEARCH_AT = 15;
const SHOW_MAX = 100;

type Place = { left: number; top: number; width: number; maxHeight: number; above: boolean };

/** A long list: same trigger, but the open list filters as you type and never renders more than SHOW_MAX rows. */
function SearchSelect({ value, options, onChange, label, className = "", icon, display, disabled = false, title, variant = "field", onOpenChange }: SelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<Place | null>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? options.filter((option) => `${option.label} ${option.searchText ?? ""}`.toLocaleLowerCase().includes(needle)) : options;
  }, [options, query]);
  const shown = matches.slice(0, SHOW_MAX);

  const setOpenState = useCallback((next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
    if (next) { setQuery(""); setActive(Math.max(0, options.findIndex((option) => option.value === value))); }
    else triggerRef.current?.focus();
  }, [onOpenChange, options, value]);

  // keep the panel under (or above) the trigger while the page scrolls or resizes
  useLayoutEffect(() => {
    if (!open) return;
    const measure = (event?: Event) => {
      // scrolling the list itself does not move the panel
      if (event?.type === "scroll" && panelRef.current?.contains(event.target as Node)) return;
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 18;
      const above = rect.top - 18;
      const flip = below < 240 && above > below;
      setPlace({ left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 260) - 12), top: flip ? rect.top - 6 : rect.bottom + 6, width: Math.max(rect.width, 260), maxHeight: Math.min(352, flip ? above : below), above: flip });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpenState(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, setOpenState]);

  // the highlighted row stays in view as the arrow keys move it
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(option: SelectOption) { onChange(option.value); setOpenState(false); }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(index + 1, shown.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
    else if (event.key === "Enter") { event.preventDefault(); if (shown[active]) choose(shown[active]); }
    else if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); setOpenState(false); }
  }

  return <>
    <button ref={triggerRef} type="button" aria-label={label} title={title} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} data-state={open ? "open" : "closed"}
      onClick={() => setOpenState(!open)}
      onKeyDown={(event) => { if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) { event.preventDefault(); setOpenState(true); } }}
      className={`group flex cursor-pointer items-center justify-between gap-2 text-left outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${triggerClass[variant]} ${className}`}>
      <span className="flex min-w-0 items-center gap-2.5">
        {icon && <Icon name={icon} className="h-[18px] w-[18px] shrink-0 text-slate-500" />}
        <span className="min-w-0 truncate">{display ?? selected?.label ?? ""}</span>
      </span>
      <Icon name="chevronDown" className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-data-[state=open]:rotate-180" />
    </button>
    {open && place && createPortal(<div ref={panelRef} style={{ left: place.left, top: place.top, width: place.width, maxHeight: place.maxHeight, transform: place.above ? "translateY(-100%)" : undefined }}
      className="fixed z-[250] flex max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-violet-950/10">
      <div className="border-b border-slate-100 p-2">
        <span className="relative block">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input autoFocus role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined} aria-label={`Search ${label.toLocaleLowerCase()}`}
            value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKey} placeholder="Type to search…"
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-violet-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-violet-100" />
        </span>
      </div>
      <div ref={listRef} id={listId} role="listbox" aria-label={label} className="min-h-0 flex-1 overflow-y-auto p-1">
        {shown.map((option, index) => {
          const checked = option.value === value;
          return <div key={option.value} id={`${listId}-${index}`} data-index={index} role="option" aria-selected={checked}
            onPointerMove={() => setActive(index)} onClick={() => choose(option)}
            className={`relative flex min-h-10 cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm ${index === active ? "bg-violet-50 text-violet-900" : "text-slate-700"} ${checked ? "font-semibold text-violet-800" : ""}`}>
            {checked && <svg {...iconProps} className="absolute left-2.5 h-4 w-4"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
            {option.label}
          </div>;
        })}
        {!shown.length && <p className="px-3 py-3 text-sm text-slate-500">No matches found.</p>}
        {matches.length > SHOW_MAX && <p className="px-3 py-2 text-xs text-slate-500">Showing {SHOW_MAX} of {matches.length}. Type to narrow the list.</p>}
      </div>
    </div>, document.body)}
  </>;
}
