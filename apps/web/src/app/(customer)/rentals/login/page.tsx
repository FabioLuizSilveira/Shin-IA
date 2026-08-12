"use client";

// Rental-customer login for the mobile-friendly web portal — a stopgap
// while app store approval for apps/mobile is pending. Same auth methods
// as the native app (magic link + Google OAuth) against the same Supabase
// project (see apps/mobile/src/screens/LoginScreen.tsx), just styled for a
// browser tab instead of a native screen.
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail } from "lucide-react";

const NEXT_AFTER_LOGIN = "/rentals";

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

export default function RentalsLoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<"google" | "magic" | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setLoading("google");
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${NEXT_AFTER_LOGIN}`,
        },
      });
      if (error) throw error;
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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-shina-blue to-shina-cyan mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white">Portal do Cliente</h1>
          <p className="text-sm text-slate-400 mt-1">Acompanhe suas locações Veloz Rent a Car</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
          <button
            type="button"
            onClick={() => void handleGoogle()}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-900 text-sm font-semibold rounded-xl border-0 cursor-pointer transition disabled:opacity-60"
          >
            {loading === "google" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
            Continuar com Google
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
                placeholder="seu@email.com"
                className="w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white text-sm placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-shina-blue hover:bg-blue-500 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer transition disabled:opacity-60"
              >
                {loading === "magic" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                Continuar com e-mail
              </button>
            </form>
          )}

          {error && (
            <div className="px-4 py-2.5 bg-red-400/10 border border-red-400/20 rounded-xl text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Locatário convidado por uma locadora parceira? Use o mesmo e-mail do convite.
        </p>
      </div>
    </div>
  );
}
