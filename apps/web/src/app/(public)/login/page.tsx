"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        throw new Error("Supabase URL não configurada. Por favor, reinicie o servidor (pnpm dev).");
      }

      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // Smart Routing based on User Role and Context
      const appMetadata = data.user?.app_metadata || {};
      const platformRole = appMetadata.platform_role;
      const tenantRole = appMetadata.tenant_role;

      if (platformRole) {
        router.push("/platform/dashboard");
      } else if (tenantRole) {
        router.push("/tenant/dashboard");
      } else {
        const role = appMetadata.role || data.user?.user_metadata?.role || "tenant_user";
        switch (role) {
          case "platform_admin":
          case "platform_user":
          case "platform_owner":
            router.push("/platform/dashboard");
            break;
          case "tenant_owner":
          case "tenant_admin":
          case "tenant_user":
          default:
            router.push("/tenant/dashboard");
        }
      }

      router.refresh();
    } catch (err: any) {
      console.error("Login erro:", err);
      setError(err.message || "Erro interno ao tentar fazer login.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm space-y-4 p-8 bg-white/5 border border-white/10 rounded-2xl shadow-xl"
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">Shinã IA</h1>
          <p className="text-sm text-slate-400 mt-1">Plataforma Unificada</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-white"
            required
          />
        </div>

        {error && <div className="text-sm text-red-400 bg-red-400/10 p-3 rounded-lg">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg flex justify-center items-center gap-2 transition"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Entrar"}
        </button>
      </form>
    </div>
  );
}
