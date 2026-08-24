"use client";
// Platform admins have no tenant_id of their own, so the tenant-scoped
// NotificationBell (/api/notifications, via requireTenantScope) never works
// for them — this is a separate, platform-only source: aggregate unread
// count across all tenants' support threads (/api/platform-support/threads),
// see notification-dropdown.tsx for the tenant-side counterpart.
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bell, MessageSquare } from "lucide-react";

interface SupportThreadSummary {
  tenantId: string;
  tenantName: string;
  lastMessage: string;
  unreadCount: number;
  lastCreatedAt: string;
}

export function PlatformNotificationBell() {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<SupportThreadSummary[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/platform-support/threads");
      if (!res.ok) return;
      const json = (await res.json()) as { data?: SupportThreadSummary[] };
      setThreads(json.data ?? []);
    } catch {
      // silently fail — polling will retry
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 10000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = threads.filter((t) => t.unreadCount > 0);
  const unreadCount = unread.reduce((sum, t) => sum + t.unreadCount, 0);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`relative p-2 rounded-lg transition-colors ${
          unreadCount > 0
            ? "text-shina-blue hover:text-blue-700 hover:bg-blue-50"
            : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        }`}
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? "fill-shina-blue/15" : ""}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        // Fixed + inset-x on mobile, same fix as notification-dropdown.tsx —
        // `right-0` alone isn't enough since the bell isn't the rightmost
        // header element, so the panel hung off the left edge of the screen.
        <div className="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Mensagens de tenants</h3>
            {unreadCount > 0 && (
              <p className="text-xs text-slate-500">
                {unreadCount} não lida{unreadCount > 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-50">
            {unread.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Nenhuma mensagem não lida</p>
              </div>
            ) : (
              unread.map((t) => (
                <Link
                  key={t.tenantId}
                  href="/platform/support"
                  onClick={() => setOpen(false)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex gap-3 bg-blue-50/40 no-underline"
                >
                  <MessageSquare className="w-4 h-4 text-shina-blue mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{t.tenantName}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.lastMessage}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
