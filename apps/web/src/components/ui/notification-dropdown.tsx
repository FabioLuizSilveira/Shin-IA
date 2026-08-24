"use client";
import { useState, useRef, useEffect } from "react";
import { Bell, X, CheckCheck, AlertCircle, Info, AlertTriangle, Zap } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return `${Math.floor(hrs / 24)}d atrás`;
}

function priorityIcon(priority: string) {
  switch (priority) {
    case "critical":
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    case "high":
      return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    case "normal":
      return <Info className="w-4 h-4 text-blue-500" />;
    default:
      return <Zap className="w-4 h-4 text-slate-400" />;
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications();
  const ref = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
        // Fixed + inset-x on mobile so the panel is pinned to the actual
        // viewport edges instead of the bell's own position — the bell
        // isn't the rightmost header element (workspace switcher/avatar
        // sit further right), so `right-0` relative to it left the panel
        // hanging off the left edge of the screen (confirmed live: left
        // edge landed at -36px on a 375px viewport). sm:absolute reverts to
        // the original bell-anchored behavior once there's enough room.
        <div className="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Notificações</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-slate-500">
                  {unreadCount} não lida{unreadCount > 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => {
                    void markAllAsRead();
                  }}
                  className="flex items-center gap-1 text-xs text-shina-blue hover:text-blue-700 font-medium"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Marcar todas
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    void markAsRead([n.id]);
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex gap-3 ${
                    n.status !== "read" ? "bg-blue-50/40" : ""
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{priorityIcon(n.priority)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm leading-tight ${
                          n.status !== "read"
                            ? "font-semibold text-slate-900"
                            : "font-medium text-slate-700"
                        }`}
                      >
                        {n.subject}
                      </p>
                      {n.status !== "read" && (
                        <span className="mt-1 shrink-0 w-2 h-2 rounded-full bg-shina-blue" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
