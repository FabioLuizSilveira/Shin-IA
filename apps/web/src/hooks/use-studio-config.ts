"use client";

import { useCallback, useEffect, useState } from "react";
import type { StudioType } from "@shina/studio";

// Shared by all 10 tenant/customization/<area> pages — the persistence and
// publish/version flow is identical for every studio type (see
// lib/studio-runtime-factory.ts), only the form UI per page differs.
export function useStudioConfig<T>(type: StudioType, emptyConfig: T) {
  const [config, setConfig] = useState<T>(emptyConfig);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant-studio/${type}`);
      const json = (await res.json()) as {
        data?: { draft: { config: T } | null; published: { config: T; version: number } | null };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar");
      const source = json.data?.draft ?? json.data?.published;
      if (source) setConfig(source.config);
      setPublishedVersion(json.data?.published?.version ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveDraft(next: T) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/tenant-studio/${type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: next }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar rascunho");
      setConfig(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function publish(changelog?: string) {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant-studio/${type}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changelog }),
      });
      const json = (await res.json()) as { data?: { version: number }; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao publicar");
      setPublishedVersion(json.data?.version ?? null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
      return false;
    } finally {
      setPublishing(false);
    }
  }

  return {
    config,
    setConfig,
    publishedVersion,
    loading,
    saving,
    publishing,
    saved,
    error,
    saveDraft,
    publish,
    reload: load,
  };
}
