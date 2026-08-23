"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { MktCommandMenu } from "@/components/layout/command-menu";
import { MktNotificationBell } from "@/components/layout/notification-bell";
import { useShinaTheme } from "@shina/theme";
import {
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
  Sun,
  Moon,
  Search,
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
  const { theme, preference, setPreference } = useShinaTheme();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-slate-950">
      <aside className="w-60 shrink-0 border-r border-slate-200 dark:border-white/5 flex flex-col">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-200 dark:border-white/5">
          <Image
            src="/brand/shina-icon-square.png"
            alt="Shinã"
            width={32}
            height={32}
            className="rounded-lg"
            priority
          />
          <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
            Marketing IA
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
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5",
                ].join(" ")}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-white/5 space-y-1">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors bg-transparent border-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-slate-200 dark:border-white/5">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
                );
              }}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer border-0"
            >
              <Search className="w-4 h-4" />
              <span className="text-xs">Buscar...</span>
              <kbd className="text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded px-1 ml-1">
                ⌘K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setPreference(preference === "dark" ? "light" : "dark")}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors bg-transparent border-0 cursor-pointer"
              title={theme.mode === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme.mode === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <MktNotificationBell />
            <WorkspaceSwitcher />
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-mkt-primary to-mkt-secondary flex items-center justify-center text-white text-[10px] font-bold ml-1">
              MKT
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <MktCommandMenu />
    </div>
  );
}
