"use client";

// CommandPalette (doc 10/19 Grupo F/6). Busca/ação global ⌘K. Spotlight +
// resultados agrupados, navegação total por teclado, foco preso.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search } from "@shina/icons";
import { cn } from "../utils/cn";

export interface CommandItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  keywords?: string;
}

export interface CommandGroup {
  heading: string;
  items: CommandItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  groups: CommandGroup[];
  placeholder?: string;
}

export function CommandPalette({
  open,
  onClose,
  groups,
  placeholder = "Buscar ou executar ação...",
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query) return groups;
    const q = query.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) => i.label.toLowerCase().includes(q) || i.keywords?.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const flatItems = useMemo(() => filtered.flatMap((g) => g.items), [filtered]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") return onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[activeIndex];
        if (item) {
          item.onSelect();
          onClose();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, flatItems, activeIndex, onClose]);

  if (!open) return null;

  let runningIndex = -1;

  return (
    <div className="fixed inset-0 z-modal flex items-start justify-center pt-[15vh] p-4">
      <div
        aria-hidden
        className="absolute inset-0 bg-[var(--shina-surface-overlay)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl rounded-xl overflow-hidden bg-[var(--shina-surface-glass)] backdrop-blur-md border border-[var(--shina-border-default)] shadow-lg"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--shina-border-subtle)]">
          <Search size={16} className="text-[var(--shina-text-tertiary)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-[var(--shina-text-primary)] placeholder:text-[var(--shina-text-tertiary)] focus:outline-none"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--shina-surface-glass-hover)] text-[var(--shina-text-tertiary)]">
            Esc
          </kbd>
        </div>

        <div role="listbox" className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="text-sm text-[var(--shina-text-tertiary)] text-center py-6">
              Nenhum resultado.
            </p>
          )}
          {filtered.map((group) => (
            <div key={group.heading} className="mb-2">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--shina-text-tertiary)]">
                {group.heading}
              </p>
              {group.items.map((item) => {
                runningIndex += 1;
                const isActive = runningIndex === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(runningIndex)}
                    onClick={() => {
                      item.onSelect();
                      onClose();
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-left transition-colors duration-fast",
                      isActive
                        ? "bg-[var(--shina-primary)]/15 text-[var(--shina-accent)]"
                        : "text-[var(--shina-text-primary)]",
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
