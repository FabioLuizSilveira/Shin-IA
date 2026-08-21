"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  LayoutDashboard,
  Library,
  Wand2,
  Copy,
  Megaphone,
  ShieldCheck,
  Palette,
  Plug,
  Bot,
  Settings,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface SearchResults {
  campaigns: { id: string; name: string; platform: string; status: string }[];
  brandKits: { id: string; name: string }[];
  generatedAds: { id: string; headline: string | null; platform: string | null; status: string }[];
  clonedAds: { id: string; adapted_headline: string | null; status: string }[];
}

interface QuickLink {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const QUICK_LINKS: QuickLink[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: "Ad Library", href: "/ad-library", icon: <Library className="w-4 h-4" /> },
  { label: "Gerador IA", href: "/generator", icon: <Wand2 className="w-4 h-4" /> },
  { label: "Ad Cloner", href: "/cloner", icon: <Copy className="w-4 h-4" /> },
  { label: "Campanhas", href: "/campaigns", icon: <Megaphone className="w-4 h-4" /> },
  { label: "Aprovações", href: "/approvals", icon: <ShieldCheck className="w-4 h-4" /> },
  { label: "Brand Kit", href: "/brand-kit", icon: <Palette className="w-4 h-4" /> },
  { label: "Integrações", href: "/integrations", icon: <Plug className="w-4 h-4" /> },
  { label: "MCP Server", href: "/mcp", icon: <Bot className="w-4 h-4" /> },
  { label: "Configurações", href: "/settings", icon: <Settings className="w-4 h-4" /> },
];

export function MktCommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults(null);
    }
  }, [open]);

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
    ? results.campaigns.length +
      results.brandKits.length +
      results.generatedAds.length +
      results.clonedAds.length
    : 0;

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        onClick={() => setOpen(false)}
      />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 z-50 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-white/5">
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
            placeholder="Buscar campanhas, anúncios, brand kits..."
            className="flex-1 text-sm text-slate-900 dark:text-white placeholder-slate-400 bg-transparent outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-transparent border-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-[420px] overflow-y-auto py-2">
          {!query && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Navegação rápida
              </p>
              {QUICK_LINKS.map((link) => (
                <button
                  key={link.href}
                  onClick={() => navigate(link.href)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left bg-transparent border-0 cursor-pointer"
                >
                  <span className="text-slate-400">{link.icon}</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{link.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 ml-auto" />
                </button>
              ))}
            </div>
          )}

          {query.length >= 2 && !loading && results && totalResults === 0 && (
            <div className="py-12 text-center">
              <Search className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhum resultado para &ldquo;<span className="font-medium">{query}</span>&rdquo;
              </p>
            </div>
          )}

          {results && results.campaigns.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Campanhas
              </p>
              {results.campaigns.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate("/campaigns")}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left bg-transparent border-0 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-mkt-primary/10 flex items-center justify-center shrink-0">
                    <Megaphone className="w-4 h-4 text-mkt-glow" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {c.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{c.platform}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                    {c.status}
                  </span>
                </button>
              ))}
            </div>
          )}

          {results && results.brandKits.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Brand Kits
              </p>
              {results.brandKits.map((b) => (
                <button
                  key={b.id}
                  onClick={() => navigate("/brand-kit")}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left bg-transparent border-0 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-mkt-primary/10 flex items-center justify-center shrink-0">
                    <Palette className="w-4 h-4 text-mkt-glow" />
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {b.name}
                  </p>
                </button>
              ))}
            </div>
          )}

          {results && results.generatedAds.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Anúncios gerados
              </p>
              {results.generatedAds.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate("/generator")}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left bg-transparent border-0 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-mkt-primary/10 flex items-center justify-center shrink-0">
                    <Wand2 className="w-4 h-4 text-mkt-glow" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {a.headline ?? "—"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{a.platform}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                    {a.status}
                  </span>
                </button>
              ))}
            </div>
          )}

          {results && results.clonedAds.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Anúncios clonados
              </p>
              {results.clonedAds.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate("/cloner")}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left bg-transparent border-0 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-mkt-primary/10 flex items-center justify-center shrink-0">
                    <Copy className="w-4 h-4 text-mkt-glow" />
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {a.adapted_headline ?? "—"}
                  </p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 ml-auto">
                    {a.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-white/5 flex items-center gap-4 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <kbd className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-1">
              ↑↓
            </kbd>{" "}
            navegar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-1">
              ↵
            </kbd>{" "}
            selecionar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded px-1">
              ESC
            </kbd>{" "}
            fechar
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
