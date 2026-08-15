"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ShieldAlert } from "lucide-react";

interface ContractInfo {
  id: string;
  title: string;
  content: string;
}

// Reached only via middleware.ts's material-contract gate (item 23) — the
// currently-published Platform contract changed in a way flagged
// material_change=true, and this tenant hasn't re-accepted it yet.
export default function TenantLegalReacceptPage() {
  const router = useRouter();
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [declaredAuthority, setDeclaredAuthority] = useState(false);
  const [contractAccepted, setContractAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/commercial/contract?product=platform")
      .then((res) => res.json() as Promise<{ data?: ContractInfo }>)
      .then((json) => {
        if (json.data) setContract(json.data);
      })
      .catch(() => setError("Não foi possível carregar o contrato."));
  }, []);

  async function handleAccept() {
    if (!name.trim() || !role.trim() || !declaredAuthority || !contractAccepted) {
      setError("Preencha todos os campos e marque os dois checkboxes.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/commercial/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          representativeName: name,
          representativeRole: role,
          declaredAuthority,
        }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Erro ao aceitar o contrato.");
      }

      // platform_contract_current is a JWT claim — refresh the session so
      // middleware sees the update immediately, same fix already applied
      // for the MFA-enrollment stale-JWT bug earlier this session.
      const supabase = createClient();
      await supabase.auth.refreshSession();
      router.push("/tenant/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Contrato atualizado">
      <SectionHeader
        title="Contrato atualizado"
        description="Os termos do seu contrato com a Shinã mudaram — é necessário revisar e aceitar novamente para continuar usando a plataforma."
      />

      <div className="max-w-xl bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Você ainda pode consultar faturas e exportar seus dados normalmente enquanto revisa — só
            ações administrativas ficam bloqueadas até o aceite.
          </p>
        </div>

        <div className="h-40 overflow-y-auto px-3.5 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          {contract ? (
            <>
              <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                {contract.title}
              </p>
              {contract.content}
            </>
          ) : (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Seu nome completo
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Cargo
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
          />
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={declaredAuthority}
            onChange={(e) => setDeclaredAuthority(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Declaro possuir poderes suficientes para aceitar este instrumento em nome da
            organização.
          </span>
        </label>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={contractAccepted}
            onChange={(e) => setContractAccepted(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Li e aceito a versão atualizada do Contrato-Mestre.
          </span>
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="button"
          onClick={() => void handleAccept()}
          disabled={submitting}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Aceitar e continuar
        </button>
      </div>
    </AppShell>
  );
}
