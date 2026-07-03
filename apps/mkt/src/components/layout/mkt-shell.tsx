"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Sparkles,
  LayoutDashboard,
  Library,
  Wand2,
  Copy,
  Megaphone,
  ShieldCheck,
  Palette,
  Plug,
  Settings,
  LogOut,
  Bot,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ad-library", label: "Ad Library", icon: Library },
  { href: "/generator", label: "Gerador IA", icon: Wand2 },
  { href: "/cloner", label: "Ad Cloner", icon: Copy },
  { href: "/campaigns", label: "Campanhas", icon: Megaphone },
  { href: "/approvals", label: "Aprovações", icon: ShieldCheck },
  { href: "/brand-kit", label: "Brand Kit", icon: Palette },
  { href: "/integrations", label: "Integrações", icon: Plug },
  { href: "/mcp", label: "MCP Server", icon: Bot },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export function MktShell({ children, title }: { children: ReactNode; title: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <aside className="w-60 shrink-0 border-r border-white/5 flex flex-col">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-mkt-primary to-mkt-secondary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-white leading-tight">
            Marketing AI
            <span className="block text-[10px] font-medium text-slate-500">by Shinã</span>
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors no-underline",
                  active
                    ? "bg-mkt-primary/15 text-mkt-glow"
                    : "text-slate-400 hover:text-white hover:bg-white/5",
                ].join(" ")}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/5">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors bg-transparent border-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 shrink-0 flex items-center px-6 border-b border-white/5">
          <h1 className="text-lg font-bold text-white">{title}</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
