"use client";

// WorkspaceSwitcher / TenantSwitcher (doc 10/19 Grupo D/5). Mesmo componente
// genérico — o rótulo ("workspace"/"tenant") é injetado pelo consumidor.

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "@shina/icons";
import { Popover } from "./popover";
import { cn } from "../utils/cn";

export interface SwitcherItem {
  id: string;
  label: string;
  sublabel?: string;
}

export interface SwitcherProps {
  current: SwitcherItem;
  items: SwitcherItem[];
  onSwitch: (item: SwitcherItem) => void;
  searchable?: boolean;
  label: string;
}

export function Switcher({ current, items, onSwitch, searchable = true, label }: SwitcherProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      query ? items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())) : items,
    [items, query],
  );

  return (
    <Popover
      trigger={
        <button
          type="button"
          aria-label={`Trocar ${label}: atual é ${current.label}`}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
            "text-[var(--shina-text-primary)] hover:bg-[var(--shina-surface-glass-hover)]",
          )}
        >
          <span className="w-6 h-6 rounded-md bg-[image:var(--shina-gradient)] flex items-center justify-center text-white text-xs font-bold">
            {current.label.charAt(0).toUpperCase()}
          </span>
          {current.label}
          <ChevronDown size={14} />
        </button>
      }
    >
      {searchable && (
        <div className="relative mb-2">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--shina-text-tertiary)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar ${label}...`}
            className="w-full pl-8 pr-2 py-1.5 text-xs rounded-md bg-[var(--shina-surface-glass)] border border-[var(--shina-border-default)] text-white placeholder:text-[var(--shina-text-tertiary)] focus:outline-none"
          />
        </div>
      )}
      <div role="listbox" className="max-h-64 overflow-y-auto space-y-0.5">
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={item.id === current.id}
            onClick={() => onSwitch(item)}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-sm text-left hover:bg-[var(--shina-surface-glass-hover)] text-[var(--shina-text-primary)]"
          >
            <span>
              {item.label}
              {item.sublabel && (
                <span className="block text-xs text-[var(--shina-text-tertiary)]">
                  {item.sublabel}
                </span>
              )}
            </span>
            {item.id === current.id && <Check size={14} className="text-[var(--shina-accent)]" />}
          </button>
        ))}
      </div>
    </Popover>
  );
}
