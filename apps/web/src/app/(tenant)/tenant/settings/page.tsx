"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { User, Building2, Check, Lock, Scale, CreditCard, FileStack } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone_number: string | null;
  avatar_url: string | null;
}

interface Company {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  default_currency: string;
  metadata: { support_email?: string; phone?: string };
  can_edit: boolean;
}

const CURRENCIES = ["BRL", "USD", "EUR"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100";

export default function TenantSettingsPage() {
  const [tab, setTab] = useState<"profile" | "company">("profile");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState({ full_name: "", phone_number: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [company, setCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    default_currency: "BRL",
    support_email: "",
    phone: "",
  });
  const [companySaving, setCompanySaving] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, companyRes] = await Promise.all([
        fetch("/api/tenant-settings/profile"),
        fetch("/api/tenant-settings/company"),
      ]);
      const profileJson = (await profileRes.json()) as { data?: Profile };
      const companyJson = (await companyRes.json()) as { data?: Company };
      if (profileJson.data) {
        setProfile(profileJson.data);
        setProfileForm({
          full_name: profileJson.data.full_name,
          phone_number: profileJson.data.phone_number ?? "",
        });
      }
      if (companyJson.data) {
        setCompany(companyJson.data);
        setCompanyForm({
          name: companyJson.data.name,
          default_currency: companyJson.data.default_currency,
          support_email: companyJson.data.metadata?.support_email ?? "",
          phone: companyJson.data.metadata?.phone ?? "",
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      const res = await fetch("/api/tenant-settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      const json = (await res.json()) as { data?: Profile };
      if (json.data) {
        setProfile(json.data);
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2000);
      }
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    setCompanySaving(true);
    setCompanySaved(false);
    try {
      const res = await fetch("/api/tenant-settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyForm.name,
          default_currency: companyForm.default_currency,
          metadata: {
            ...company?.metadata,
            support_email: companyForm.support_email || undefined,
            phone: companyForm.phone || undefined,
          },
        }),
      });
      const json = (await res.json()) as { data?: Company };
      if (json.data) {
        setCompany(json.data);
        setCompanySaved(true);
        setTimeout(() => setCompanySaved(false), 2000);
      }
    } finally {
      setCompanySaving(false);
    }
  }

  return (
    <AppShell title="Configurações">
      <SectionHeader
        title="Configurações"
        description="Seu perfil e as configurações da empresa."
      />

      <div className="flex items-center gap-1 mb-5 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setTab("profile")}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-0 border-b-2 cursor-pointer bg-transparent ${
            tab === "profile"
              ? "border-shina-blue text-shina-blue"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <User className="w-3.5 h-3.5" /> Perfil
        </button>
        <button
          type="button"
          onClick={() => setTab("company")}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-0 border-b-2 cursor-pointer bg-transparent ${
            tab === "company"
              ? "border-shina-blue text-shina-blue"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" /> Empresa
        </button>
        <Link
          href="/tenant/settings/legal"
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-0 border-b-2 border-transparent text-slate-500 hover:text-slate-700 no-underline"
        >
          <Scale className="w-3.5 h-3.5" /> Jurídico
        </Link>
        <Link
          href="/tenant/settings/billing"
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-0 border-b-2 border-transparent text-slate-500 hover:text-slate-700 no-underline"
        >
          <CreditCard className="w-3.5 h-3.5" /> Assinatura
        </Link>
        <Link
          href="/tenant/settings/legal/contract-templates"
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-0 border-b-2 border-transparent text-slate-500 hover:text-slate-700 no-underline"
        >
          <FileStack className="w-3.5 h-3.5" /> Templates de Contrato
        </Link>
      </div>

      {loading ? (
        <div className="h-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse" />
      ) : tab === "profile" ? (
        <form
          onSubmit={(e) => void handleSaveProfile(e)}
          className="max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
        >
          <Field label="Nome completo">
            <input
              required
              value={profileForm.full_name}
              onChange={(e) => setProfileForm((f) => ({ ...f, full_name: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="E-mail">
            <input readOnly value={profile?.email ?? ""} className={`${inputClass} opacity-60`} />
          </Field>
          <Field label="Telefone">
            <input
              value={profileForm.phone_number}
              onChange={(e) => setProfileForm((f) => ({ ...f, phone_number: e.target.value }))}
              placeholder="(11) 99999-9999"
              className={inputClass}
            />
          </Field>
          <button
            type="submit"
            disabled={profileSaving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white rounded-lg border-0 cursor-pointer"
          >
            {profileSaved ? (
              <>
                <Check className="w-4 h-4" /> Salvo
              </>
            ) : (
              "Salvar"
            )}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => void handleSaveCompany(e)}
          className="max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
        >
          {company && !company.can_edit && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 rounded-lg px-3 py-2">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              Só administradores e proprietários do tenant podem editar as configurações da empresa.
            </div>
          )}
          <fieldset
            disabled={company ? !company.can_edit : true}
            className="space-y-4 border-0 p-0 m-0"
          >
            <Field label="Nome da empresa">
              <input
                required
                value={companyForm.name}
                onChange={(e) => setCompanyForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Identificador (slug)">
              <input readOnly value={company?.slug ?? ""} className={`${inputClass} opacity-60`} />
            </Field>
            <Field label="Moeda padrão">
              <select
                value={companyForm.default_currency}
                onChange={(e) =>
                  setCompanyForm((f) => ({ ...f, default_currency: e.target.value }))
                }
                className={inputClass}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="E-mail de suporte">
              <input
                type="email"
                value={companyForm.support_email}
                onChange={(e) => setCompanyForm((f) => ({ ...f, support_email: e.target.value }))}
                placeholder="suporte@suaempresa.com"
                className={inputClass}
              />
            </Field>
            <Field label="Telefone">
              <input
                value={companyForm.phone}
                onChange={(e) => setCompanyForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(11) 3333-4444"
                className={inputClass}
              />
            </Field>
          </fieldset>
          {company?.can_edit && (
            <button
              type="submit"
              disabled={companySaving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-shina-blue hover:bg-blue-600 disabled:opacity-60 text-white rounded-lg border-0 cursor-pointer"
            >
              {companySaved ? (
                <>
                  <Check className="w-4 h-4" /> Salvo
                </>
              ) : (
                "Salvar"
              )}
            </button>
          )}
        </form>
      )}
    </AppShell>
  );
}
