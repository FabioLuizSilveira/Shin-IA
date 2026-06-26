"use client";
import { useState, useEffect, useCallback } from "react";

export interface Notification {
  id: string;
  subject: string;
  body: string;
  priority: "low" | "normal" | "high" | "critical";
  status: "pending" | "sent" | "delivered" | "failed" | "read";
  created_at: string;
}

export function useNotifications(pollingIntervalMs = 10000) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const json = (await res.json()) as { data: Notification[] };
      setNotifications(json.data ?? []);
    } catch {
      // silently fail — polling will retry
    } finally {
      setLoading(false);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, status: "read" as const })));
  }, []);

  const markAsRead = useCallback(async (ids: string[]) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, status: "read" as const } : n)),
    );
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => {
      void fetchNotifications();
    }, pollingIntervalMs);
    return () => clearInterval(interval);
  }, [fetchNotifications, pollingIntervalMs]);

  const unreadCount = notifications.filter((n) => n.status !== "read").length;

  return {
    notifications,
    unreadCount,
    loading,
    markAllAsRead,
    markAsRead,
    refetch: fetchNotifications,
  };
}
