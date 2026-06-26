"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Zap,
  Truck,
  FileText,
  Users,
  LayoutDashboard,
  Settings,
  BarChart2,
  Package,
  ArrowRight,
  Loader2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface SearchResults {
  operations: {
    id: string;
    type: string;
    status: string;
    scheduled_starts_at: string;
    resources: { name: string } | null;
  }[];
  assets: {
    id: string;
    name: string;
    category: string;
    status: string;
    serial_number?: string;
  }[];
  contracts: {
    id: string;
    type: string;
    status: string;
    value_amount: number;
    value_currency: string;
    organizations: { name: string } | null;
  }[];
  organizations: {
    id: string;
    name: string;
    type: string;
    document: string;
    address_city: string;
  }[];
}

interface QuickLink {
  label: string;
  href: string;
  icon: React.ReactNode;
  shortcut?: string;
}

// ── Quick nav links (always shown when query is empty) ──────────────────────

const QUICK_LINKS: QuickLink[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="w-4 h-4" />,
  },
  {
    label: "Operações",
    href: "/operations",
    icon: <Zap className="w-4 h-4" />,
    shortcut: "O",
  },
  {
    label: "Frota & Ativos",
    href: "/assets",
    icon: <Truck className="w-4 h-4" />,
    shortcut: "A",
  },
  {
    label: "Contratos",
    href: "/contracts",
    icon: <FileText className="w-4 h-4" />,
    shortcut: "C",
  },
  {
    label: "Clientes & Parceiros",
    href: "/crm",
    icon: <Users className="w-4 h-4" />,
    shortcut: "P",
  },
  {
    label: "Relatórios",
    href: "/reports",
    icon: <BarChart2 className="w-4 h-4" />,
  },
  {
    label: "Configurações",
    href: "/settings",
    icon: <Settings className="w-4 h-4" />,
  },
];

// ── Labels ─────────────────────────────────────────────────────────────────

const typeLabels: Record<string, string> = {
  delivery: "Entrega",
  pickup: "Coleta",
  maintenance: "Manutenção",
  inspection: "Inspeção",
  transfer: "Transferência",
  service: "Serviço",
  rental: "Locação",
  lease: "Arrendamento",
  subscription: "Assinatura",
  one_time: "Avulso",
  vehicle: "Veículo",
  equipment: "Equipamento",
  tool: "Ferramenta",
  property: "Imóvel",
  technology: "Tecnologia",
  customer: "Cliente",
  supplier: "Fornecedor",
  partner: "Parceiro",
  internal: "Interno",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-slate-100 text-slate-500",
  failed: "bg-red-100 text-red-700",
  draft: "bg-slate-100 text-slate-600",
  active: "bg-green-100 text-green-700",
  suspended: "bg-orange-100 text-orange-700",
  terminated: "bg-red-100 text-red-700",
  available: "bg-green-100 text-green-700",
  in_use: "bg-blue-100 text-blue-700",
  maintenance: "bg-amber-100 text-amber-700",
  decommissioned: "bg-slate-100 text-slate-500",
};

// ── Main component ──────────────────────────────────────────────────────────

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
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
      setResults(null);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const json = (await res.json()) as { data: SearchResults };
        setResults(json.data);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const totalResults = results
    ? results.operations.length +
      results.assets.length +
      results.contracts.length +
      results.organizations.length
    : 0;

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
          {loading ? (
            <Loader2 className="w-5 h-5 text-slate-400 shrink-0 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar operações, ativos, contratos..."
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

          {/* Query but no results yet */}
          {query.length >= 2 && !loading && results && totalResults === 0 && (
            <div className="py-12 text-center">
              <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                Nenhum resultado para &ldquo;
                <span className="font-medium">{query}</span>&rdquo;
              </p>
            </div>
          )}

          {/* Operations */}
          {results && results.operations.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Operações
              </p>
              {results.operations.map((op) => (
                <button
                  key={op.id}
                  onClick={() => navigate("/operations")}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-shina-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {typeLabels[op.type] ?? op.type}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{op.resources?.name ?? "—"}</p>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[op.status] ?? ""}`}
                  >
                    {op.status}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Assets */}
          {results && results.assets.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Ativos
              </p>
              {results.assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => navigate("/assets")}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-shina-cyan" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{asset.name}</p>
                    <p className="text-xs text-slate-500">
                      {typeLabels[asset.category] ?? asset.category}
                      {asset.serial_number ? ` · ${asset.serial_number}` : ""}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[asset.status] ?? ""}`}
                  >
                    {asset.status}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Contracts */}
          {results && results.contracts.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Contratos
              </p>
              {results.contracts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate("/contracts")}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {typeLabels[c.type] ?? c.type}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {c.organizations?.name ?? "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-slate-700">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: c.value_currency,
                      }).format(Number(c.value_amount))}
                    </p>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColors[c.status] ?? ""}`}
                    >
                      {c.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Organizations */}
          {results && results.organizations.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Organizações
              </p>
              {results.organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => navigate("/crm")}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{org.name}</p>
                    <p className="text-xs text-slate-500">
                      {typeLabels[org.type] ?? org.type} · {org.address_city}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 shrink-0">{org.document}</p>
                </button>
              ))}
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
            Shinã Search
          </span>
        </div>
      </div>
    </>
  );
}
