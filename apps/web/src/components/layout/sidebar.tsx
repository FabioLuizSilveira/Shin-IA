"use client";

import Image from "next/image";
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
  Sparkles,
  Map,
  Shield,
  Building2,
  CreditCard,
  Headphones,
  Puzzle,
  MessageSquareWarning,
  History,
  Palette,
  UserCog,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const PLATFORM_NAV_ITEMS = [
  { href: "/platform/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/platform/tenants", label: "Tenants", icon: Building2 },
  { href: "/platform/billing", label: "Faturamento", icon: CreditCard },
  { href: "/platform/support", label: "Suporte", icon: Headphones },
  { href: "/platform/marketplace", label: "Marketplace", icon: Puzzle },
  { href: "/platform/ai", label: "AI Center", icon: Sparkles },
  { href: "/platform/settings", label: "Configurações", icon: Settings },
];

const TENANT_NAV_ITEMS = [
  { href: "/tenant/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tenant/tracking", label: "Mapa da Frota", icon: Map },
  { href: "/tenant/operations", label: "Operações", icon: Zap },
  { href: "/tenant/resources", label: "Recursos", icon: Users2 },
  { href: "/tenant/assets", label: "Frota & Ativos", icon: Truck },
  { href: "/tenant/crm", label: "Clientes & Parceiros", icon: Users },
  { href: "/tenant/contracts", label: "Contratos", icon: FileText },
  { href: "/tenant/operators", label: "Operadores", icon: UserCog },
  { href: "/tenant/billing", label: "Financeiro", icon: DollarSign },
  { href: "/tenant/reports", label: "Relatórios", icon: BarChart2 },
  { href: "/tenant/commission", label: "Comissões", icon: Award },
  {
    href: "/tenant/customer-requests",
    label: "Pedidos de Clientes",
    icon: MessageSquareWarning,
  },
  { href: "/tenant/activity", label: "Atividade", icon: History },
  { href: "/tenant/support", label: "Suporte", icon: Headphones },
  { href: "/tenant/studio", label: "Controle de Acesso", icon: Shield },
  { href: "/tenant/ai", label: "AI Center", icon: Sparkles },
  { href: "/tenant/apps", label: "Apps", icon: Puzzle },
  { href: "/tenant/customization", label: "Customização", icon: Palette },
  { href: "/tenant/settings", label: "Configurações", icon: Settings },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isPlatform = pathname.startsWith("/platform");
  const navItems = isPlatform ? PLATFORM_NAV_ITEMS : TENANT_NAV_ITEMS;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="w-60 h-full bg-shina-navy dark:bg-slate-900 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Image
            src="/brand/shina-icon-square.png"
            alt="Shinã"
            width={32}
            height={32}
            className="rounded-lg"
            priority
          />
          <div>
            <span className="text-white font-bold text-lg font-display tracking-tight">Shinã</span>
            <span className="ml-2 text-xs font-medium text-shina-cyan bg-shina-cyan/20 px-1.5 py-0.5 rounded">
              Portal
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <ul className="sidebar-scroll flex-1 min-h-0 overflow-y-auto py-4 px-3 space-y-0.5 list-none m-0 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
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
