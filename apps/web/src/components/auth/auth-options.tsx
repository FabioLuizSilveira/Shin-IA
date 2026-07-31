"use client";

// Opções de autenticação da Shinã Identity — compartilhado entre a página
// /login e o modal "Entrar" do site institucional. Sem senha: OAuth
// (Google/Facebook, Apple preparado porém desabilitado) e Magic Link via
// Supabase Auth. O redirect passa pelo /auth/callback já existente.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail } from "lucide-react";

const NEXT_AFTER_LOGIN = "/dashboard"; // middleware redireciona por papel

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8H1.2v3.1A12 12 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.2a12 12 0 0 0 0 10.8l4.1-3.1z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.2 6.6l4.1 3.1A7.2 7.2 0 0 1 12 4.8z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8.79-.16 2.09-.86 3.51-.73 1.71.14 3 .81 3.85 2.04-3.53 2.11-2.7 6.75.53 8.05-.65 1.29-1.51 2.58-2.97 2.81zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" aria-hidden>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.09 24 18.1 24 12.07z" />
    </svg>
  );
}

export function AuthOptions() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOAuth(provider: "google" | "facebook") {
    setLoading(provider);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${NEXT_AFTER_LOGIN}`,
        },
      });
      if (error) throw error;
      // navegação para o provedor acontece via redirect — loading fica ativo
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar login.");
      setLoading(null);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading("magic");
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${NEXT_AFTER_LOGIN}`,
        },
      });
      if (error) throw error;
      setMagicSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar o link.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void handleOAuth("google")}
        disabled={loading !== null}
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-900 text-sm font-semibold rounded-xl border-0 cursor-pointer transition disabled:opacity-60"
      >
        {loading === "google" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
        Continuar com Google
      </button>

      <button
        type="button"
        disabled
        title="Em breve"
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white/10 text-white/40 text-sm font-semibold rounded-xl border-0 cursor-not-allowed"
      >
        <AppleIcon />
        Continuar com Apple
        <span className="text-[10px] font-bold uppercase tracking-wide bg-white/10 px-1.5 py-0.5 rounded-full">
          em breve
        </span>
      </button>

      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-slate-400">ou</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {magicSent ? (
        <div className="px-4 py-3 bg-green-400/10 border border-green-400/20 rounded-xl text-sm text-green-300 text-center">
          Link enviado! Verifique seu e-mail para entrar.
        </div>
      ) : (
        <form onSubmit={(e) => void handleMagicLink(e)} className="space-y-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com.br"
            className="w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white text-sm placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer transition disabled:opacity-60"
          >
            {loading === "magic" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            Continuar com E-mail
          </button>
        </form>
      )}

      {showMore ? (
        <button
          type="button"
          onClick={() => void handleOAuth("facebook")}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer transition disabled:opacity-60"
        >
          {loading === "facebook" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FacebookIcon />}
          Continuar com Facebook
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="w-full text-xs text-slate-400 hover:text-slate-300 bg-transparent border-0 cursor-pointer py-1"
        >
          Mais opções
        </button>
      )}

      {error && (
        <div className="px-4 py-2.5 bg-red-400/10 border border-red-400/20 rounded-xl text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
