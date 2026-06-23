"use client";

import { Search } from "lucide-react";
import { NotificationBell } from "@/components/ui/notification-dropdown";

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  return (
    <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-6 flex-shrink-0">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
              }),
            );
          }}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border-0"
        >
          <Search className="w-4 h-4" />
          <span className="text-xs">Buscar...</span>
          <kbd className="text-[10px] bg-white border border-slate-200 rounded px-1 ml-1">⌘K</kbd>
        </button>
        <NotificationBell />
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-shina-blue to-shina-cyan flex items-center justify-center text-white text-xs font-bold ml-1">
          T
        </div>
      </div>
    </header>
  );
}
