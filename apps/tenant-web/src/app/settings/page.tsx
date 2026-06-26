"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/layout/app-shell";
import { Building2, User, Shield, Save, Check, Users2, UserPlus, X, Bell } from "lucide-react";
import type { UserProfile, UserProfileStatus } from "@/types/domain";

const TABS = ["Empresa", "Perfil", "Segurança", "Equipe", "Notificações"] as const;
type Tab = (typeof TABS)[number];

// Plan badge colors
const planColors: Record<string, string> = {
  starter: "bg-slate-100 text-slate-700",
  professional: "bg-blue-100 text-blue-700",
  enterprise: "bg-purple-100 text-purple-700",
};

// --- Team helpers ---
function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const avatarColors = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-cyan-500",
];
function avatarColor(name: string): string {
  const idx = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[idx];
}

function formatLogin(dt: string | null | undefined): string {
  if (!dt) return "Nunca";
  return new Date(dt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const statusConfig: Record<UserProfileStatus, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-green-100 text-green-700" },
  inactive: { label: "Inativo", className: "bg-slate-100 text-slate-600" },
  suspended: { label: "Suspenso", className: "bg-red-100 text-red-700" },
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

  // team
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviting, setInviting] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  // notification prefs
  const [emailOps, setEmailOps] = useState(true);
  const [emailInvoices, setEmailInvoices] = useState(true);
  const [emailTeam, setEmailTeam] = useState(true);
  const [emailGeneral, setEmailGeneral] = useState(true);
  const [savingNotif, setSavingNotif] = useState(false);
  const [savedNotif, setSavedNotif] = useState(false);

  const supabase = createClient();

  const fetchTeam = useCallback(async () => {
    setTeamLoading(true);
    setTeamError(null);
    try {
      const res = await fetch("/api/team");
      if (!res.ok) throw new Error("Falha ao carregar equipe");
      const json = (await res.json()) as { data: UserProfile[] };
      setTeam(json.data ?? []);
    } catch (e) {
      setTeamError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setTeamLoading(false);
    }
  }, []);

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
        // load notification prefs from user metadata
        const meta = data.user.user_metadata as Record<string, boolean> | undefined;
        if (meta) {
          setEmailOps(meta.email_ops ?? true);
          setEmailInvoices(meta.email_invoices ?? true);
          setEmailTeam(meta.email_team ?? true);
          setEmailGeneral(meta.email_general ?? true);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "Equipe") {
      void fetchTeam();
    }
  }, [activeTab, fetchTeam]);

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

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setTeamError(null);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: inviteName,
          email: inviteEmail,
          phone_number: invitePhone || undefined,
        }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Falha ao convidar membro");
      }
      setShowInviteForm(false);
      setInviteName("");
      setInviteEmail("");
      setInvitePhone("");
      await fetchTeam();
    } catch (e) {
      setTeamError(e instanceof Error ? e.message : "Erro ao convidar");
    } finally {
      setInviting(false);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      const res = await fetch(`/api/team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "inactive" }),
      });
      if (!res.ok) throw new Error("Falha ao desativar");
      await fetchTeam();
    } catch (e) {
      setTeamError(e instanceof Error ? e.message : "Erro ao desativar");
    }
  }

  async function handleSaveNotifications() {
    setSavingNotif(true);
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        email_ops: emailOps,
        email_invoices: emailInvoices,
        email_team: emailTeam,
        email_general: emailGeneral,
      },
    });
    setSavingNotif(false);
    if (!updateError) {
      setSavedNotif(true);
      setTimeout(() => setSavedNotif(false), 3000);
    }
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
                <p className="mt-1 text-xs text-slate-400">
                  O email não pode ser alterado por aqui
                </p>
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
                  <p className="text-xs text-slate-500 mt-0.5">
                    Adicione uma camada extra de segurança
                  </p>
                </div>
                <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-500 rounded-full">
                  Em breve
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Equipe tab */}
        {activeTab === "Equipe" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Users2 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Membros da Equipe</h2>
                  <p className="text-xs text-slate-500">{team.length} membro(s) encontrado(s)</p>
                </div>
              </div>
              {!showInviteForm && (
                <button
                  onClick={() => setShowInviteForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-shina-blue text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Convidar Membro
                </button>
              )}
            </div>

            {/* Invite form */}
            {showInviteForm && (
              <form
                onSubmit={(e) => void handleInvite(e)}
                className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">Convidar Novo Membro</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteForm(false);
                      setTeamError(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Nome completo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Ex: João Silva"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="joao@empresa.com.br"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue bg-slate-50"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Telefone (opcional)
                    </label>
                    <input
                      type="text"
                      value={invitePhone}
                      onChange={(e) => setInvitePhone(e.target.value)}
                      placeholder="+55 11 99999-9999"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-shina-blue/30 focus:border-shina-blue bg-slate-50"
                    />
                  </div>
                </div>
                {teamError && <p className="mt-3 text-xs text-red-600">{teamError}</p>}
                <div className="flex gap-3 mt-4">
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-4 py-2 bg-shina-blue text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    {inviting ? "Convidando..." : "Convidar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteForm(false);
                      setTeamError(null);
                    }}
                    className="px-4 py-2 text-slate-600 rounded-xl text-sm bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* Team error (outside form) */}
            {teamError && !showInviteForm && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {teamError}
              </div>
            )}

            {/* Team list */}
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {teamLoading ? (
                <div>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-40" />
                        <div className="h-3 bg-slate-100 rounded animate-pulse w-56" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : team.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Users2 className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">Nenhum membro encontrado</p>
                </div>
              ) : (
                team.map((member) => {
                  const cfg = statusConfig[member.status] ?? statusConfig.inactive;
                  return (
                    <div key={member.id} className="flex items-center gap-4 px-4 py-3">
                      {/* Avatar */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${avatarColor(member.full_name)}`}
                      >
                        {initials(member.full_name)}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {member.full_name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{member.email}</p>
                      </div>
                      {/* Status badge */}
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${cfg.className}`}
                      >
                        {cfg.label}
                      </span>
                      {/* Last login */}
                      <div className="text-xs text-slate-400 shrink-0 w-28 text-right hidden sm:block">
                        {formatLogin(member.last_login_at)}
                      </div>
                      {/* Action */}
                      {member.status === "active" && (
                        <button
                          onClick={() => void handleDeactivate(member.id)}
                          className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                        >
                          Desativar
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
        {/* Notificações tab */}
        {activeTab === "Notificações" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Notificações por Email</h2>
                  <p className="text-xs text-slate-500">
                    Escolha quais eventos geram emails para você
                  </p>
                </div>
              </div>

              {savedNotif && (
                <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                  <Check className="w-4 h-4" /> Preferências salvas!
                </div>
              )}

              <div className="space-y-1">
                {(
                  [
                    {
                      id: "notif-ops",
                      label: "Operações",
                      description: "Atualizações de status das suas operações",
                      value: emailOps,
                      onChange: setEmailOps,
                    },
                    {
                      id: "notif-invoices",
                      label: "Faturas",
                      description: "Avisos de vencimento e pagamento de faturas",
                      value: emailInvoices,
                      onChange: setEmailInvoices,
                    },
                    {
                      id: "notif-team",
                      label: "Equipe",
                      description: "Convites e alterações de membros da equipe",
                      value: emailTeam,
                      onChange: setEmailTeam,
                    },
                    {
                      id: "notif-general",
                      label: "Geral",
                      description: "Novidades, releases e comunicados da plataforma",
                      value: emailGeneral,
                      onChange: setEmailGeneral,
                    },
                  ] as const
                ).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-4 border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                    </div>
                    <button
                      id={item.id}
                      type="button"
                      role="switch"
                      aria-checked={item.value}
                      onClick={() => item.onChange(!item.value)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        item.value ? "bg-blue-600" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          item.value ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <button
                  id="save-notifications"
                  type="button"
                  onClick={() => void handleSaveNotifications()}
                  disabled={savingNotif}
                  className="flex items-center gap-2 px-5 py-2.5 bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {savingNotif ? "Salvando..." : "Salvar preferências"}
                </button>
              </div>
            </div>

            {/* Info card */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800">
                <strong>📬 Dica:</strong> Os emails são enviados para o endereço da sua conta (
                {email || "…"}). Para alterar o email, entre em contato com o suporte.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
