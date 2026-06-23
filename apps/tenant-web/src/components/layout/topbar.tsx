"use client";

import { Search, Bell } from "lucide-react";

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  return (
    <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-6 flex-shrink-0">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      <div className="flex items-center gap-2">
        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer bg-transparent border-0">
          <Search className="w-4 h-4" />
        </button>
        <div className="relative">
          <button className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer bg-transparent border-0">
            <Bell className="w-4 h-4" />
          </button>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-shina-blue rounded-full" />
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-shina-blue to-shina-cyan flex items-center justify-center text-white text-xs font-bold ml-1">
          T
        </div>
      </div>
    </header>
  );
}
