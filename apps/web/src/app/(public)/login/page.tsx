"use client";

// Login da Shinã Identity — sem senha na UI pública: OAuth + Magic Link
// via Supabase Auth (ver components/auth/auth-options.tsx). O redirect
// pós-login passa pelo /auth/callback e o middleware roteia /dashboard
// para o dashboard certo conforme o papel (platform vs tenant).
import { AuthOptions } from "@/components/auth/auth-options";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm p-8 bg-white/5 border border-white/10 rounded-2xl shadow-xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">Shinã IA</h1>
          <p className="text-sm text-slate-400 mt-1">Uma conta para todos os produtos Shinã</p>
        </div>

        <AuthOptions />

        <p className="text-[11px] text-slate-500 text-center mt-6">
          Ao continuar, você concorda com os termos de uso e a política de privacidade da Shinã.
        </p>
      </div>
    </div>
  );
}
