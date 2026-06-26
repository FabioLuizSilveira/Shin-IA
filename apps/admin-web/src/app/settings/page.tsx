"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/layout/app-shell";
import { Monitor, User, Save, Check, CheckCircle } from "lucide-react";

const TABS = ["Plataforma", "Perfil"] as const;
type Tab = (typeof TABS)[number];

interface AnalyticsData {
  total: number;
}

const HEALTH_SERVICES = [
  { label: "API", status: "healthy" },
  { label: "Database", status: "healthy" },
  { label: "Auth", status: "healthy" },
] as const;

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Plataforma");
  // analytics
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  // profile
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  // feedback
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((j) => setAnalytics(j.data as AnalyticsData));

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? "");
        setFullName((data.user.user_metadata?.full_name as string) ?? "");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleSaveProfile() {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    showSaved();
  }

  return (
    <AppShell title="Configurações">
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 font-display">Configurações</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie a plataforma e o seu perfil de administrador
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 mb-8 gap-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setError(null);
              setSaved(false);
            }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-shina-blue text-shina-blue"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {saved && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          <Check className="w-4 h-4" /> Salvo com sucesso!
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Plataforma tab */}
      {activeTab === "Plataforma" && (
        <div className="space-y-6">
          {/* Platform info */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-shina-blue/10 flex items-center justify-center">
                <Monitor className="w-5 h-5 text-shina-blue" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Informações da Plataforma</h2>
                <p className="text-xs text-slate-500">Versão e ambiente atual</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Versão</label>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  1.0.0-beta
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Ambiente</label>
                <p className="text-sm text-slate-600">Local Development</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Total de Tenants
                </label>
                {analytics !== null ? (
                  <p className="text-sm font-semibold text-slate-900">{analytics.total}</p>
                ) : (
                  <div className="h-5 w-16 bg-slate-100 rounded animate-pulse" />
                )}
              </div>
            </div>
          </div>

          {/* System health */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Saúde do Sistema</h2>
            <div className="space-y-3">
              {HEALTH_SERVICES.map(({ label }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{label}</span>
                  <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Operacional
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Perfil tab */}
      {activeTab === "Perfil" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-shina-cyan/10 flex items-center justify-center">
              <User className="w-5 h-5 text-shina-cyan" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Perfil do Administrador</h2>
              <p className="text-xs text-slate-500">Suas informações pessoais</p>
            </div>
          </div>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nome completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 bg-slate-100 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-slate-400">O email não pode ser alterado por aqui</p>
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? "Salvando..." : "Salvar perfil"}
            </button>
          </div>
        </div>
      )}
    </div>
    </AppShell>
  );
}
