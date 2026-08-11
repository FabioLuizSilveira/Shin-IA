"use client";

// Login da Shinã Identity — sem senha na UI pública: OAuth + Magic Link
// via Supabase Auth (ver components/auth/auth-options.tsx). O redirect
// pós-login passa pelo /auth/callback e o middleware roteia /dashboard
// para o dashboard certo conforme o papel (platform vs tenant).
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthOptions } from "@/components/auth/auth-options";

// The most common reason exchangeCodeForSession fails: the magic link was
// opened in a different browser/device than the one that requested it —
// PKCE's code_verifier cookie lives only in the requesting browser.
const REASON_MESSAGES: Record<string, string> = {
  missing_code: "O link parece incompleto. Solicite um novo link de acesso.",
  "both auth code and code verifier should be non-empty":
    "Abra o link de acesso no mesmo navegador em que você pediu o login.",
};

function CallbackError() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const reason = searchParams.get("reason");
  if (!error) return null;

  const message =
    (reason && REASON_MESSAGES[reason]) ||
    "Não foi possível concluir o login. Solicite um novo link de acesso e tente de novo.";

  return (
    <div className="px-4 py-2.5 mb-4 bg-red-400/10 border border-red-400/20 rounded-xl text-sm text-red-300">
      {message}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm p-8 bg-white/5 border border-white/10 rounded-2xl shadow-xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">Shinã IA</h1>
          <p className="text-sm text-slate-400 mt-1">Uma conta para todos os produtos Shinã</p>
        </div>

        <Suspense>
          <CallbackError />
        </Suspense>
        <AuthOptions />

        <p className="text-[11px] text-slate-500 text-center mt-6">
          Ao continuar, você concorda com os termos de uso e a política de privacidade da Shinã.
        </p>
      </div>
    </div>
  );
}
