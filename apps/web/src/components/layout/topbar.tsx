"use client";

import { Search, Sun, Moon, Menu } from "lucide-react";
import { NotificationBell } from "@/components/ui/notification-dropdown";
import { useTheme } from "@/lib/theme/theme-context";

interface TopbarProps {
  title: string;
  onMenuClick?: () => void;
}

export function Topbar({ title, onMenuClick }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 bg-transparent border-0 cursor-pointer"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      </div>
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
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer border-0"
        >
          <Search className="w-4 h-4" />
          <span className="text-xs">Buscar...</span>
          <kbd className="text-[10px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1 ml-1">
            ⌘K
          </kbd>
        </button>
        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-400 transition-colors bg-transparent border-0 cursor-pointer"
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <NotificationBell />
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-shina-blue to-shina-cyan flex items-center justify-center text-white text-xs font-bold ml-1">
          T
        </div>
      </div>
    </header>
  );
}
