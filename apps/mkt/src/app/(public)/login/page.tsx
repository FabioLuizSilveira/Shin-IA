"use client";

export const dynamic = "force-dynamic";

import { useState, Suspense } from "react";
import { GoogleAuthProvider, sendSignInLinkToEmail, signInWithPopup } from "firebase/auth";
import { createClient } from "@/lib/supabase/client";
import { firebaseAuth } from "@/lib/firebase-client";
import { establishFirebaseSession } from "@/lib/firebase-session";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Mail, Eye, EyeOff } from "lucide-react";

const MAGIC_LINK_EMAIL_STORAGE_KEY = "shina_magic_link_email";

// Client-side mirror of IDENTITY_PROVIDER — see apps/web's identical flag
// for why this must never be set in Vercel until apps/mobile is migrated
// too. Only "firebase" changes behavior; anything else (including unset)
// keeps today's Supabase-only flow untouched.
const USE_FIREBASE = process.env.NEXT_PUBLIC_IDENTITY_PROVIDER === "firebase";

// Mesmo design system de /signup (liquid-glass, Instrument Serif itálico —
// herdado do layout do grupo (public), ver (public)/layout.tsx). Esta
// página vivia fora do grupo (public) antes, por isso divergia visualmente
// do resto do site institucional (fontes/fundo diferentes).
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
  const [loading, setLoading] = useState<"password" | "google" | "magic" | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only allow internal paths — a full URL here would be an open redirect.
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    // The password field/button are hidden under USE_FIREBASE (see the
    // form below), but pressing Enter in the email input still submits
    // this form — route that to magic link instead of a silent Supabase
    // password attempt with an empty password.
    if (USE_FIREBASE) return handleFirebaseMagicLink();
    setLoading("password");
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
      setLoading(null);
      return;
    }

    router.push(next);
    router.refresh();
  }

  // Mesma conta usada em app.shinaia.com.br — muitas contas nunca tiveram
  // senha (login sempre foi via Google ou magic link no resto da
  // plataforma), então o formulário de senha sozinho deixava essas contas
  // sem como entrar aqui. Reaproveita o /api/auth/callback já existente
  // (usado hoje só pelo signup), passando `next` para diferenciar os dois
  // fluxos — ver comentário na rota.
  async function handleFirebaseGoogle() {
    setLoading("google");
    setError(null);
    try {
      const cred = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      const idToken = await cred.user.getIdToken();
      await establishFirebaseSession(idToken, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar login.");
      setLoading(null);
    }
  }

  async function handleGoogleLogin() {
    if (USE_FIREBASE) return handleFirebaseGoogle();

    setLoading("google");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
  }

  // Firebase's sendSignInLinkToEmail() has no shouldCreateUser:false
  // equivalent — /api/auth/firebase/magic-link/precheck (server-side)
  // decides whether an account actually exists first; the UI always shows
  // "link enviado" regardless, so a failed precheck doesn't leak which
  // emails have accounts (same anti-enumeration posture the Supabase flow
  // already had). Mirrors apps/web's identical handler.
  async function handleFirebaseMagicLink() {
    if (!email.trim()) return;
    setLoading("magic");
    setError(null);
    try {
      const precheckRes = await fetch("/api/auth/firebase/magic-link/precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const precheckJson = await precheckRes.json();
      if (precheckJson?.data?.allowed) {
        window.localStorage.setItem(MAGIC_LINK_EMAIL_STORAGE_KEY, email.trim());
        await sendSignInLinkToEmail(firebaseAuth, email.trim(), {
          url: `${window.location.origin}/auth/magic-link-callback?next=${encodeURIComponent(next)}`,
          handleCodeInApp: true,
        });
      }
      setMagicSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar o link.");
    } finally {
      setLoading(null);
    }
  }

  // shouldCreateUser: false — login nunca cria conta nova em silêncio
  // (mesma regra já usada no magic-link do app mobile).
  async function handleMagicLink() {
    if (USE_FIREBASE) return handleFirebaseMagicLink();
    if (!email.trim()) return;
    setLoading("magic");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
    } else {
      setMagicSent(true);
    }
    setLoading(null);
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-24">
      <div className="w-full max-w-md liquid-glass rounded-3xl p-8">
        <h1 className="font-heading italic text-3xl text-white text-center mb-2">
          Bem-vindo de volta
        </h1>
        <p className="font-body text-sm text-white/70 text-center mb-8">
          Acesse seu workspace de marketing
        </p>

        <div className="space-y-3 mb-6">
          <button
            type="button"
            onClick={() => void handleGoogleLogin()}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 liquid-glass rounded-full text-white font-body font-semibold text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {loading === "google" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
            {loading === "google" ? "Conectando…" : "Continuar com Google"}
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1 bg-white/10" />
          <span className="font-body text-xs text-white/40">ou</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
          <div>
            <label htmlFor="email" className="block font-body text-sm text-white/70 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="voce@empresa.com.br"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 font-body text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            />
          </div>

          {/* Login por senha ainda produz só uma sessão Supabase — com o
              backend em Firebase (USE_FIREBASE), essa sessão não seria
              reconhecida pelo middleware nem por requireTenantScope() no
              app.$ROOT_DOMAIN, então fica oculto em vez de quebrado em
              silêncio (mesmo tratamento já dado ao Facebook em apps/web).
              O restante da plataforma já é password-less (Google/magic
              link), então nenhuma conta nova depende de senha. */}
          {!USE_FIREBASE && (
            <div>
              <label htmlFor="password" className="block font-body text-sm text-white/70 mb-1.5">
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
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 font-body text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors bg-transparent border-0 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {noAccount && (
            <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-body text-sm">
              <p className="text-white/80">
                Não tem conta ainda?{" "}
                <Link href="/signup" className="text-white font-semibold hover:underline">
                  Vamos começar
                </Link>
                .
              </p>
              <p className="text-white/40 text-xs mt-1">
                Ou confira se o e-mail e a senha estão corretos.
              </p>
            </div>
          )}

          {error && <p className="font-body text-sm text-red-400 text-center">{error}</p>}

          {!USE_FIREBASE && (
            <button
              type="submit"
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black rounded-full font-body font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {loading === "password" ? "Entrando…" : "Entrar"}
            </button>
          )}
        </form>

        {magicSent ? (
          <div className="mt-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-body text-sm text-white/70 text-center">
            Link enviado! Verifique seu e-mail para entrar.
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void handleMagicLink()}
            disabled={loading !== null || !email.trim()}
            className="w-full flex items-center justify-center gap-2 mt-3 px-4 py-2.5 liquid-glass rounded-full text-white/70 font-body text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {loading === "magic" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            Enviar link de acesso por e-mail
          </button>
        )}

        <p className="font-body text-xs text-white/50 text-center mt-6">
          Não tem uma conta?{" "}
          <Link href="/signup" className="text-white/80 hover:text-white">
            Criar conta
          </Link>
        </p>
        <p className="font-body text-[11px] text-white/30 text-center mt-2">
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
