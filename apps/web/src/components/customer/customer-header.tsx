"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { consumeDemoRedirect } from "@/lib/demo-session";

interface CustomerHeaderProps {
  title: string;
  onBack?: () => void;
}

// Shared chrome for the (customer) portal — same dark "Shinã Identity" look
// as (public)/login (bg-slate-950, white/5 glass, gradient logo mark), not
// the light tenant-dashboard style. Deliberately not used on rentals/login
// (unauthenticated — no session to sign out of yet).
export function CustomerHeader({ title, onBack }: CustomerHeaderProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    const landing = consumeDemoRedirect();
    if (landing) {
      window.location.href = landing;
      return;
    }
    router.push("/rentals/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-white/10 px-4 py-4">
      <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1 -ml-1 cursor-pointer border-0 bg-transparent text-slate-400 hover:text-white transition shrink-0"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          {!onBack && (
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-shina-blue to-shina-cyan flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs leading-none">S</span>
            </div>
          )}
          <h1 className="text-base font-bold text-white truncate">{title}</h1>
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg cursor-pointer transition shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sair
        </button>
      </div>
    </header>
  );
}
