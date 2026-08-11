"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles, Eye, EyeOff } from "lucide-react";
import { Suspense } from "react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Supabase returns the same generic "Invalid login credentials" for a
  // wrong password and for an email with no account at all (by design, to
  // avoid user enumeration) — so this can't be told apart from a typo'd
  // password. We treat it as "maybe no account yet" and point at signup
  // instead of just repeating the confusing raw Supabase message.
  const [noAccount, setNoAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only allow internal paths — a full URL here would be an open redirect.
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNoAccount(false);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message === "Invalid login credentials") {
        setNoAccount(true);
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mkt-primary to-mkt-secondary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">
            Shinã <span className="text-gradient-mkt">Marketing IA</span>
          </span>
        </div>

        <div className="card-glass rounded-2xl p-8">
          <h1 className="text-xl font-bold text-white mb-1">Bem-vindo de volta</h1>
          <p className="text-sm text-slate-400 mb-6">Acesse seu workspace de marketing</p>

          <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="voce@empresa.com.br"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-mkt-primary/40 focus:border-mkt-primary/40 transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-mkt-primary/40 focus:border-mkt-primary/40 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors bg-transparent border-0 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {noAccount && (
              <div className="px-4 py-3 rounded-xl bg-mkt-primary/10 border border-mkt-primary/20 text-sm">
                <p className="text-slate-200">
                  Não tem conta ainda?{" "}
                  <Link href="/signup" className="text-mkt-primary font-semibold hover:underline">
                    Vamos começar
                  </Link>
                  .
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  Ou confira se o e-mail e a senha estão corretos.
                </p>
              </div>
            )}

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-xl bg-mkt-primary hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all cursor-pointer border-0"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Mesma conta da plataforma Shinã — IAM unificado
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
