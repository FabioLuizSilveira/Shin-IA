"use client";

// One-click "puro demo" entry linked from the marketing landing's ProductDemo
// CTAs ("Ver como Equipe" / "Ver como Cliente"). No login screen: sign in as
// the fixed demo account for the persona (api/mobile/demo-login, already
// whitelisted in middleware) and drop the visitor into the real experience.
// markDemoSession() lets the app's "Sair" send them back to the landing.
//
// NOTE: Supabase path only. If NEXT_PUBLIC_IDENTITY_PROVIDER is ever set to
// "firebase" (see auth-options.tsx), the firebase demo-login branch from
// handleDemoLogin() has to be mirrored here too.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LANDING_URL, markDemoSession } from "@/lib/demo-session";

const DESTINATION: Record<"tenant" | "customer", string> = {
  tenant: "/tenant/dashboard",
  customer: "/rentals",
};

const COPY = {
  tenant: "Entrando na demonstração do painel…",
  customer: "Entrando na demonstração do app do cliente…",
};

function isPersona(value: string | undefined): value is "tenant" | "customer" {
  return value === "tenant" || value === "customer";
}

export default function DemoEntryPage() {
  const params = useParams<{ persona: string }>();
  const persona = isPersona(params.persona) ? params.persona : null;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!persona) {
      setFailed(true);
      return;
    }

    let cancelled = false;

    async function enterDemo(target: "tenant" | "customer") {
      try {
        const res = await fetch("/api/mobile/demo-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ persona: target }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "demo-login failed");

        const supabase = createClient();
        const { error } = await supabase.auth.setSession({
          access_token: json.data.access_token,
          refresh_token: json.data.refresh_token,
        });
        if (error) throw error;
        if (cancelled) return;

        markDemoSession();
        window.location.href = DESTINATION[target];
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void enterDemo(persona);
    return () => {
      cancelled = true;
    };
  }, [persona]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 text-center">
      <div className="w-full max-w-sm">
        {failed ? (
          <>
            <h1 className="text-lg font-semibold text-white">Demonstração indisponível</h1>
            <p className="mt-2 text-sm text-slate-400">
              Não foi possível abrir a demonstração agora. Tente novamente em instantes.
            </p>
            <a
              href={LANDING_URL}
              className="mt-6 inline-block px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold text-white transition"
            >
              Voltar para o site
            </a>
          </>
        ) : (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-shina-cyan mx-auto" />
            <p className="mt-4 text-sm text-slate-300">
              {persona ? COPY[persona] : "Entrando na demonstração…"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
