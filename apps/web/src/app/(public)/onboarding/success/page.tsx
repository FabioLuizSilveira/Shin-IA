"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

// Success page NEVER activates anything itself (item 34) — it only polls
// /api/onboarding/status until the webhook has confirmed payment and
// flipped the tenant to "active"/"trialing". A redirect here is not proof
// of payment; only the webhook is.
export default function OnboardingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingSuccessContent />
    </Suspense>
  );
}

function OnboardingSuccessContent() {
  const params = useSearchParams();
  const tenantId = params.get("tenant_id");
  const [status, setStatus] = useState<"processing" | "active" | "error">("processing");

  useEffect(() => {
    if (!tenantId) {
      setStatus("error");
      return;
    }
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/onboarding/status?tenant_id=${tenantId}`);
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { data?: { tenantStatus: string } };
        if (cancelled) return;
        if (json.data?.tenantStatus === "active" || json.data?.tenantStatus === "trialing") {
          setStatus("active");
          setTimeout(() => {
            window.location.href = "/dashboard";
          }, 1500);
          return;
        }
      } catch {
        // transient — keep polling
      }
      if (!cancelled) setTimeout(poll, 2000);
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-blue-950/20 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        {status === "processing" && (
          <>
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Pagamento em processamento
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Aguarde enquanto confirmamos seu pagamento — isso costuma levar poucos segundos.
            </p>
          </>
        )}
        {status === "active" && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Tudo pronto!
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Redirecionando para o seu dashboard...
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Não foi possível confirmar
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Link inválido. Se você concluiu o pagamento, contate o suporte.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
