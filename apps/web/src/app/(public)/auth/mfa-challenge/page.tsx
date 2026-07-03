"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Shield, Loader2, AlertCircle, ChevronRight } from "lucide-react";

function MfaChallengeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only allow internal paths — a full URL here would be an open redirect.
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Informe os 6 dígitos do código.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();

    // Supabase Auth MFA — challenge + verify
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: await getFactorId(supabase),
    });

    if (challengeError || !challengeData) {
      setError(challengeError?.message ?? "Erro ao iniciar desafio MFA");
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: await getFactorId(supabase),
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      setError("Código inválido. Verifique seu aplicativo autenticador.");
      setLoading(false);
      return;
    }

    // Server validates the session reached aal2 and sets the signed
    // httpOnly mfa_verified cookie — it cannot be forged client-side.
    const confirmRes = await fetch("/api/auth/mfa/confirm", { method: "POST" });
    if (!confirmRes.ok) {
      setError("Falha ao confirmar verificação MFA. Tente novamente.");
      setLoading(false);
      return;
    }

    router.push(next);
  }

  async function getFactorId(supabase: ReturnType<typeof createClient>): Promise<string> {
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp?.[0];
    if (!factor) throw new Error("Nenhum fator MFA encontrado");
    return factor.id;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Verificação em duas etapas</h1>
          <p className="text-slate-400 text-sm mt-1">
            Abra o seu aplicativo autenticador e insira o código de 6 dígitos.
          </p>
        </div>

        <form onSubmit={(e) => void handleVerify(e)} className="space-y-4">
          {/* Code input */}
          <div>
            <label htmlFor="mfa-code" className="block text-xs font-medium text-slate-400 mb-1.5">
              Código de verificação
            </label>
            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              autoFocus
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-xl font-mono tracking-widest text-center placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            id="mfa-verify-submit"
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl transition shadow-lg shadow-blue-500/20"
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

        {/* Recovery link */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Perdeu o acesso ao autenticador?{" "}
          <a href="/auth/recovery" className="text-blue-400 hover:text-blue-300 transition">
            Usar código de recuperação
          </a>
        </p>
      </div>
    </div>
  );
}

export default function MfaChallengePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <MfaChallengeContent />
    </Suspense>
  );
}
