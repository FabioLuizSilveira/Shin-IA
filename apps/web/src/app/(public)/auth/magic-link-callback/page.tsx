"use client";

// Completes a Firebase email-link ("magic link") sign-in — the
// actionCodeSettings.url every link sent by AuthOptions.tsx points at.
// Kept separate from the existing /auth/callback (Supabase's own PKCE
// exchange) rather than branching that page, so neither flow can
// accidentally interfere with the other's query-string/fragment parsing.

import { useEffect, useState } from "react";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import { establishFirebaseSession } from "@/lib/firebase-session";

const STORAGE_KEY = "shina_magic_link_email";

export default function MagicLinkCallbackPage() {
  const [status, setStatus] = useState<"working" | "need-email" | "error">("working");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void complete(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  async function complete(storedEmail: string | null) {
    if (!isSignInWithEmailLink(firebaseAuth, window.location.href)) {
      setError("Este link não é válido ou já foi usado.");
      setStatus("error");
      return;
    }
    if (!storedEmail) {
      // Link opened on a different device/browser than the one that
      // requested it — Firebase can still complete sign-in, but needs the
      // email confirmed again since it isn't in this browser's storage.
      setStatus("need-email");
      return;
    }
    try {
      const cred = await signInWithEmailLink(firebaseAuth, storedEmail, window.location.href);
      window.localStorage.removeItem(STORAGE_KEY);
      const idToken = await cred.user.getIdToken();
      await establishFirebaseSession(idToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao concluir o login.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm p-8 bg-white/5 border border-white/10 rounded-2xl shadow-xl text-center">
        {status === "working" && <p className="text-slate-300 text-sm">Entrando...</p>}

        {status === "need-email" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void complete(email);
            }}
            className="space-y-3"
          >
            <p className="text-slate-300 text-sm mb-2">
              Confirme seu e-mail para concluir o login.
            </p>
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
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer transition"
            >
              Continuar
            </button>
          </form>
        )}

        {status === "error" && (
          <>
            <p className="text-red-300 text-sm mb-3">{error}</p>
            <a href="/login" className="text-blue-400 text-sm hover:text-blue-300 transition">
              Voltar para o login
            </a>
          </>
        )}
      </div>
    </div>
  );
}
