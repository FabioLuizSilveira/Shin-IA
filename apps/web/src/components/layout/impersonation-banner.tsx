"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

interface ImpersonationStatus {
  tenantId: string;
  tenantName: string;
  accessMode: "full" | "read_only";
  reason: string;
  startedAt: string;
  maxDurationMinutes: number;
}

export function ImpersonationBanner() {
  const router = useRouter();
  const [status, setStatus] = useState<ImpersonationStatus | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/impersonation/status")
      .then((res) => res.json())
      .then((json: { data: ImpersonationStatus | null }) => {
        if (!cancelled) setStatus(json.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEnd() {
    setEnding(true);
    try {
      await fetch("/api/impersonation/end", { method: "POST" });
      router.push("/platform/dashboard");
      router.refresh();
    } finally {
      setEnding(false);
    }
  }

  if (!status) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-500 text-amber-950 text-sm font-medium">
      <ShieldAlert className="w-4 h-4 shrink-0" />
      <span>
        Acessando como suporte em <strong>{status.tenantName}</strong>
        {status.accessMode === "read_only" ? " (somente leitura)" : ""} — {status.reason}
      </span>
      <button
        type="button"
        onClick={() => void handleEnd()}
        disabled={ending}
        className="ml-auto px-3 py-1 bg-amber-950/10 hover:bg-amber-950/20 rounded-md text-xs font-semibold cursor-pointer border-0 disabled:opacity-60"
      >
        {ending ? "Encerrando..." : "Encerrar personificação"}
      </button>
    </div>
  );
}
