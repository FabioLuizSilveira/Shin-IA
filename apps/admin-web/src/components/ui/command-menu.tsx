"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Building2,
  CreditCard,
  Activity,
  Shield,
  Bot,
  Users,
  Settings,
  ArrowRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface QuickLink {
  label: string;
  href: string;
  icon: React.ReactNode;
  shortcut?: string;
}

// ── Quick nav links ─────────────────────────────────────────────────────────

const QUICK_LINKS: QuickLink[] = [
  {
    label: "Tenants",
    href: "/tenants",
    icon: <Building2 className="w-4 h-4" />,
  },
  {
    label: "Billing",
    href: "/billing",
    icon: <CreditCard className="w-4 h-4" />,
  },
  {
    label: "Observability",
    href: "/observability",
    icon: <Activity className="w-4 h-4" />,
  },
  { label: "Audit", href: "/audit", icon: <Shield className="w-4 h-4" /> },
  { label: "AI Center", href: "/ai", icon: <Bot className="w-4 h-4" /> },
  { label: "CRM", href: "/crm", icon: <Users className="w-4 h-4" /> },
  {
    label: "Configurações",
    href: "/settings",
    icon: <Settings className="w-4 h-4" />,
  },
];

// ── Main component ──────────────────────────────────────────────────────────

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Open/close with Cmd+K / Ctrl+K and Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
    }
  }, [open]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Navegar para..."
            className="flex-1 text-sm text-slate-900 placeholder-slate-400 bg-transparent outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto py-2">
          {/* No query → quick links */}
          {!query && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Navegação rápida
              </p>
              {QUICK_LINKS.map((link) => (
                <button
                  key={link.href}
                  onClick={() => navigate(link.href)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                >
                  <span className="text-slate-400">{link.icon}</span>
                  <span className="text-sm text-slate-700">{link.label}</span>
                  {link.shortcut && (
                    <kbd className="ml-auto text-[10px] text-slate-400 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                      {link.shortcut}
                    </kbd>
                  )}
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 ml-auto" />
                </button>
              ))}
            </div>
          )}

          {/* Query typed → "coming soon" message */}
          {query.length > 0 && (
            <div className="py-12 text-center">
              <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Busca em breve</p>
              <p className="text-xs text-slate-400 mt-1">
                Use a navegação rápida acima para acessar as seções
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <kbd className="bg-slate-100 border border-slate-200 rounded px-1">↑↓</kbd> navegar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-slate-100 border border-slate-200 rounded px-1">↵</kbd> selecionar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-slate-100 border border-slate-200 rounded px-1">ESC</kbd> fechar
          </span>
          <span className="ml-auto flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Admin Panel
          </span>
        </div>
      </div>
    </>
  );
}
