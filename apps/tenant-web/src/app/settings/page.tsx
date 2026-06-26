"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/layout/app-shell";
import { Building2, User, Shield, Save, Check } from "lucide-react";

const TABS = ["Empresa", "Perfil", "Segurança"] as const;
type Tab = (typeof TABS)[number];

// Plan badge colors
const planColors: Record<string, string> = {
  starter: "bg-slate-100 text-slate-700",
  professional: "bg-blue-100 text-blue-700",
  enterprise: "bg-purple-100 text-purple-700",
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Empresa");
  // tenant data
  const [tenant, setTenant] = useState<{
    name: string;
    slug: string;
    plan: string;
    status: string;
    created_at: string;
  } | null>(null);
  // profile
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  // password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // feedback
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    // fetch tenant
    fetch("/api/tenant")
      .then((r) => r.json())
      .then((j) => setTenant(j.data));
    // fetch current user
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

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }
    if (newPassword.length < 8) {
      setError("Senha deve ter ao menos 8 caracteres");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    showSaved();
  }

  return (
    <AppShell title="Configurações">
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 font-display">Configurações</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie as configurações da sua conta e empresa
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

      {/* Empresa tab */}
      {activeTab === "Empresa" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-shina-blue/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-shina-blue" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Informações da Empresa</h2>
                <p className="text-xs text-slate-500">Dados cadastrais do tenant</p>
              </div>
            </div>
            {tenant ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Nome da Empresa
                  </label>
                  <p className="text-sm font-semibold text-slate-900">{tenant.name}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Slug</label>
                  <p className="text-sm text-slate-600 font-mono">{tenant.slug}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Plano</label>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${planColors[tenant.plan] ?? planColors.starter}`}
                  >
                    {tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm font-medium ${tenant.status === "active" ? "text-green-600" : "text-slate-500"}`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${tenant.status === "active" ? "bg-green-500" : "bg-slate-400"}`}
                    />
                    {tenant.status === "active" ? "Ativo" : tenant.status}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Membro desde
                  </label>
                  <p className="text-sm text-slate-600">
                    {new Date(tenant.created_at).toLocaleDateString("pt-BR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            )}
          </div>

          {/* Plan info card */}
          <div className="bg-gradient-to-r from-shina-navy to-slate-800 rounded-xl p-6 text-white">
            <h3 className="text-sm font-semibold mb-1">Plano Professional</h3>
            <p className="text-xs text-slate-400 mb-4">
              Para alterar seu plano, entre em contato com o suporte.
            </p>
            <div className="grid grid-cols-3 gap-4">
              {[
                ["Operações", "Ilimitadas"],
                ["Ativos", "500"],
                ["Usuários", "50"],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-lg font-bold">{val}</p>
                  <p className="text-xs text-slate-400">{label}</p>
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
              <h2 className="text-sm font-semibold text-slate-900">Perfil do Usuário</h2>
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

      {/* Segurança tab */}
      {activeTab === "Segurança" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Alterar Senha</h2>
                <p className="text-xs text-slate-500">Mínimo 8 caracteres</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nova senha
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Confirmar senha
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue bg-slate-50"
                />
              </div>
              <button
                onClick={handleChangePassword}
                disabled={saving || !newPassword}
                className="flex items-center gap-2 px-5 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Shield className="w-4 h-4" />
                {saving ? "Salvando..." : "Alterar senha"}
              </button>
            </div>
          </div>

          {/* 2FA placeholder */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Autenticação em dois fatores
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Adicione uma camada extra de segurança</p>
              </div>
              <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-500 rounded-full">
                Em breve
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
    </AppShell>
  );
}
