"use client";

// Shown after login only to accounts with 2+ distinct products reachable
// from the same session (see middleware.ts's accessCount()) — e.g. a user
// who is both tenant staff and a platform admin, or a tenant owner who also
// holds a live Shinã MKT subscription. Single-product accounts (the
// overwhelming majority) never see this; middleware sends them straight to
// their one destination.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { decodeSessionClaims, hasLiveSubscription } from "@shina/billing-platform/claims";
import { mktUrl } from "@/lib/domain";
import { Building2, LayoutDashboard, Sparkles, Loader2, ArrowRight } from "lucide-react";

interface WorkspaceOption {
  key: "platform" | "tenant" | "mkt";
  label: string;
  description: string;
  href: string;
  icon: typeof Building2;
  external?: boolean;
}

export default function ChooseWorkspacePage() {
  const router = useRouter();
  const [options, setOptions] = useState<WorkspaceOption[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const claims = decodeSessionClaims(data.session.access_token);
      const list: WorkspaceOption[] = [];
      if (claims.platform_role) {
        list.push({
          key: "platform",
          label: "Administração da Plataforma",
          description: "Tenants, faturamento, suporte e configurações globais.",
          href: "/platform/dashboard",
          icon: Building2,
        });
      }
      if (claims.tenant_id) {
        list.push({
          key: "tenant",
          label: "Portal do Tenant",
          description: "Operações, frota, contratos e financeiro da sua empresa.",
          href: "/tenant/dashboard",
          icon: LayoutDashboard,
        });
      }
      if (hasLiveSubscription(claims.mkt_subscription_status)) {
        list.push({
          key: "mkt",
          label: "Shinã MKT",
          description: "Marketing com IA — campanhas, conteúdo e automações.",
          href: mktUrl("/dashboard"),
          icon: Sparkles,
          external: true,
        });
      }

      // Safety net: someone with 0-1 options landing here directly gets
      // routed to their single destination instead of an empty screen.
      if (list.length < 2) {
        router.replace(list[0]?.href ?? "/rentals");
        return;
      }
      setOptions(list);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!options) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-shina-blue to-shina-cyan mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white">Para onde você quer ir?</h1>
          <p className="text-sm text-slate-400 mt-1">
            Sua conta tem acesso a mais de um espaço da Shinã.
          </p>
        </div>

        <div className="space-y-3">
          {options.map(({ key, label, description, href, icon: Icon, external }) => (
            <a
              key={key}
              href={href}
              className="flex items-center gap-4 bg-white/5 border border-white/10 hover:border-shina-blue/50 hover:bg-white/[0.07] rounded-2xl p-4 transition no-underline"
            >
              <div className="w-10 h-10 rounded-xl bg-shina-blue/15 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-shina-blue" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
              {external && <span className="sr-only">(abre em outro app)</span>}
            </a>
          ))}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Você pode trocar de espaço a qualquer momento pelo menu no topo da tela.
        </p>
      </div>
    </div>
  );
}
