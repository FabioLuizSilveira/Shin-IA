"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  Truck,
  FileText,
  DollarSign,
  Award,
  Settings,
  LogOut,
  BarChart2,
  Users,
  Users2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/operations", label: "Operações", icon: Zap },
  { href: "/resources", label: "Recursos", icon: Users2 },
  { href: "/assets", label: "Frota & Ativos", icon: Truck },
  { href: "/crm", label: "Clientes & Parceiros", icon: Users },
  { href: "/contracts", label: "Contratos", icon: FileText },
  { href: "/financial", label: "Financeiro", icon: DollarSign },
  { href: "/reports", label: "Relatórios", icon: BarChart2 },
  { href: "/commissions", label: "Comissões", icon: Award },
  { href: "/settings", label: "Configurações", icon: Settings },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="w-60 h-full bg-shina-navy dark:bg-slate-900 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-shina-blue to-shina-cyan flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-lg font-display tracking-tight">Shinã</span>
            <span className="ml-2 text-xs font-medium text-shina-cyan bg-shina-cyan/20 px-1.5 py-0.5 rounded">
              Portal
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <ul className="flex-1 py-4 px-3 space-y-0.5 list-none m-0 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 no-underline ${
                  isActive
                    ? "bg-shina-blue/20 text-white border-l-2 border-shina-blue pl-[10px]"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-shina-blue" : ""}`} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* User footer */}
      <div className="px-3 pb-4 border-t border-white/10 pt-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-all duration-150 cursor-pointer bg-transparent border-0"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </nav>
  );
}
