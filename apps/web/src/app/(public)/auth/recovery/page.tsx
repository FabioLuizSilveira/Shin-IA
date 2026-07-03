"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, AlertCircle, ChevronRight } from "lucide-react";

function MfaRecoveryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only allow internal paths — a full URL here would be an open redirect.
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  const [recoveryCode, setRecoveryCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recoveryCode.trim()) {
      setError("Informe o código de recuperação.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/mfa/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: recoveryCode.trim().toUpperCase() }),
    });

    const json = (await res.json()) as { error?: string; valid?: boolean };

    if (!res.ok || json.error || !json.valid) {
      setError(json.error ?? "Código de recuperação inválido ou já utilizado.");
      setLoading(false);
      return;
    }

    // Mark MFA as verified for this session
    document.cookie = "mfa_verified=1; path=/; SameSite=Lax; max-age=86400";

    router.push(next);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Código de recuperação</h1>
          <p className="text-slate-400 text-sm mt-1">
            Use um dos códigos de recuperação gerados durante o setup do MFA.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label
              htmlFor="recovery-code"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Código de recuperação
            </label>
            <input
              id="recovery-code"
              type="text"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              autoFocus
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-center placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            id="recovery-submit"
            type="submit"
            disabled={loading || !recoveryCode.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold rounded-xl transition"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Verificar <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Tem acesso ao autenticador?{" "}
          <a href="/auth/mfa-challenge" className="text-blue-400 hover:text-blue-300 transition">
            Usar código TOTP
          </a>
        </p>
      </div>
    </div>
  );
}

export default function MfaRecoveryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      }
    >
      <MfaRecoveryContent />
    </Suspense>
  );
}
