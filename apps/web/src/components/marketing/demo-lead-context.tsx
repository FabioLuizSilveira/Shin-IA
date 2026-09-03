"use client";

// Shared "Agendar Demo" lead-capture modal — mounted once in
// (public)/layout.tsx, opened from Navbar/Hero/CtaFooter's "Agendar Demo"/
// "Agendar Demonstração" buttons via useDemoLead().open(), which previously
// just linked to appUrl("/login") (no actual demo scheduling happened).
// Submits to the same /api/contact route the "Fale com nossa equipe" form
// already uses — same real crm_leads pipeline, not a separate one — with
// phone + fleet_size as the two fields that route didn't collect before.
import { createContext, useContext, useState } from "react";
import { X, Loader2, ArrowRight } from "lucide-react";

interface DemoLeadContextValue {
  open: (source?: string) => void;
}

const DemoLeadContext = createContext<DemoLeadContextValue | null>(null);

export function useDemoLead(): DemoLeadContextValue {
  const ctx = useContext(DemoLeadContext);
  if (!ctx) throw new Error("useDemoLead must be used within DemoLeadProvider");
  return ctx;
}

// "Até 10 ativos" / "Até 50 ativos" / "Mais de 50 ativos" -> a representative
// integer for crm_leads.estimated_fleet_size (a plain integer column, not a
// bucket enum) — 10/50/100 as the ceiling of each bucket, good enough for a
// sales-qualification estimate, not meant to be an exact count. "Ativos",
// not "carros" here -- unlike the Autoloc (car-rental-only) LP, the Shinã
// Platform site targets fleets of any physical asset (agro, construção,
// logística, indústria — see hero.tsx's own copy), not just vehicles.
const FLEET_SIZE_OPTIONS: { label: string; value: string }[] = [
  { label: "Até 10 ativos", value: "10" },
  { label: "Até 50 ativos", value: "50" },
  { label: "Mais de 50 ativos", value: "100" },
];

export function DemoLeadProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [source, setSource] = useState("demo");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    fleetSize: FLEET_SIZE_OPTIONS[0].value,
  });

  function open(src = "demo") {
    setSource(src);
    setStatus("idle");
    setIsOpen(true);
  }
  function close() {
    setIsOpen(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          profile: "locador",
          fleet_size: Number(form.fleetSize),
          source,
        }),
      });
      if (!res.ok) throw new Error("request failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <DemoLeadContext.Provider value={{ open }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="absolute inset-0" onClick={close} aria-hidden="true" />
          <div className="relative w-full max-w-md p-8 bg-slate-950 border border-white/10 rounded-2xl shadow-2xl">
            <button
              type="button"
              onClick={close}
              className="absolute top-4 right-4 p-1.5 text-white/50 hover:text-white bg-transparent border-0 cursor-pointer"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>

            {status === "success" ? (
              <div className="text-center py-6">
                <h2 className="text-xl font-bold text-white mb-2">Recebemos seu pedido!</h2>
                <p className="text-sm text-white/70">
                  Nossa equipe entra em contato em breve pra agendar sua demonstração.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white">Agende sua demonstração</h2>
                <p className="text-sm text-white/60 mt-1 mb-6">
                  Preencha e nossa equipe entra em contato pra marcar o melhor horário.
                </p>
                <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
                  <input
                    required
                    placeholder="Nome completo"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/30 transition-colors"
                  />
                  <input
                    required
                    type="email"
                    placeholder="E-mail"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/30 transition-colors"
                  />
                  <input
                    required
                    placeholder="Telefone / WhatsApp"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/30 transition-colors"
                  />
                  <select
                    value={form.fleetSize}
                    onChange={(e) => setForm((f) => ({ ...f, fleetSize: e.target.value }))}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-white/30 transition-colors"
                  >
                    {FLEET_SIZE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-slate-900">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {status === "error" && (
                    <p className="text-sm text-red-400">Algo deu errado. Tente novamente.</p>
                  )}
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-body font-semibold text-black disabled:opacity-60 border-0 cursor-pointer"
                  >
                    {status === "loading" ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <>
                        Agendar demonstração <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </DemoLeadContext.Provider>
  );
}
