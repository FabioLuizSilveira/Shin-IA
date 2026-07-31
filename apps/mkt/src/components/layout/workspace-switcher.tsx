"use client";

// Lets a user who has both a Platform tenant/staff role AND a live Shinã MKT
// subscription switch products without a second login — the shared auth
// cookie (see lib/supabase/{client,server}.ts) already carries the session
// across app.$ROOT_DOMAIN and mkt.$ROOT_DOMAIN, so this is just a link.
// Renders nothing if the user only has access to one product.
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { decodeSessionClaims, hasLiveSubscription } from "@shina/billing-platform/claims";
import { appUrl } from "@/lib/domain";
import { ChevronDown, LayoutGrid, Check } from "lucide-react";

interface Workspace {
  key: "platform" | "mkt";
  label: string;
  href: string;
}

export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      const claims = decodeSessionClaims(data.session.access_token);
      const list: Workspace[] = [];
      if (claims.tenant_id || claims.platform_role) {
        list.push({ key: "platform", label: "Plataforma", href: appUrl("/dashboard") });
      }
      if (hasLiveSubscription(claims.mkt_subscription_status)) {
        list.push({ key: "mkt", label: "Shinã MKT", href: "/dashboard" });
      }
      setWorkspaces(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!workspaces || workspaces.length < 2) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors bg-transparent border-0 cursor-pointer"
      >
        <LayoutGrid className="w-4 h-4 shrink-0" />
        Trocar produto
        <ChevronDown className="w-3 h-3 ml-auto" />
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-1.5 w-48 bg-slate-900 rounded-xl border border-white/10 shadow-lg py-1 z-50">
          {workspaces.map((w) => (
            <a
              key={w.key}
              href={w.href}
              className="flex items-center justify-between px-3 py-2 text-sm text-slate-200 hover:bg-white/5 no-underline"
            >
              {w.label}
              {w.key === "mkt" && <Check className="w-3.5 h-3.5 text-mkt-glow" />}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
