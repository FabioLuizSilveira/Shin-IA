-- WAVE 3 — COMMERCIAL + CONTRACT for the Intelligent Tenant Onboarding
-- initiative. Pricing is deterministic and versioned; the composed contract
-- is FROZEN with a content hash and is immutable once frozen (STOP
-- conditions: ContractSnapshot-mutable, incomplete-contract-to-signature,
-- hash-mismatch-ignored, Pricing-recalculated).
--
-- Reuses (does NOT touch): plans / plan_versions / contract_templates /
-- contract_versions / commercial_terms_snapshots / commercial_configurations
-- / @shina/signature-platform (signature_requests etc.). This migration adds
-- only:
--   pricing_rules                    — versioned pricing catalog (control plane)
--   contract_composition_templates   — versioned commercial-annex templates
--                                      ({{token}} slots), NOT the legal body
--   onboarding_contract_snapshots    — the composed + frozen contract per
--                                      commercial_configuration, hash-sealed

-- ── 1. pricing_rules (versioned, control plane) ───────────────────────────
create table if not exists pricing_rules (
  rule_version integer primary key,
  active boolean not null default false,
  rules jsonb not null,
  notes text,
  created_at timestamptz not null default now()
);
alter table pricing_rules enable row level security;
alter table pricing_rules force row level security;
create policy "pricing_rules_select_active" on pricing_rules for select to authenticated
  using (active = true);
create unique index if not exists pricing_rules_one_active
  on pricing_rules (active) where active = true;

insert into pricing_rules (rule_version, active, rules, notes)
values (
  1, true,
  '{
    "currency": "BRL",
    "extensionPriceCents": {
      "tracking": 9900,
      "integrations": 14900,
      "ai_credits_pack": 4900,
      "tracking_pro": 19900,
      "telemetry_connector": 12900
    },
    "commitmentDiscountPct": [
      {"minMonths": 12, "pct": 10},
      {"minMonths": 24, "pct": 15}
    ],
    "yearlyPrepayDiscountPct": 15,
    "volumeDiscountPctByAssetCount": [
      {"minAssets": 100, "pct": 5},
      {"minAssets": 300, "pct": 10}
    ]
  }'::jsonb,
  'v1 — extension add-on prices + commitment/volume/annual discounts.'
)
on conflict (rule_version) do nothing;

-- ── 2. contract_composition_templates (versioned annex) ───────────────────
-- The LEGAL body always comes from contract_versions unchanged. This is the
-- per-tenant "ANEXO — CONDIÇÕES COMERCIAIS" block, with {{token}} slots that
-- the onboarding flow fills from the BusinessProfile + CommercialConfiguration
-- + pricing. `required_vars` is the readiness contract: freeze is refused
-- while any of these is missing or any {{token}} remains unresolved.
create table if not exists contract_composition_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version integer not null,
  title text not null,
  body text not null,
  required_vars text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (key, version)
);
alter table contract_composition_templates enable row level security;
alter table contract_composition_templates force row level security;
create policy "contract_composition_templates_select_active"
  on contract_composition_templates for select to authenticated
  using (active = true);
create unique index if not exists contract_composition_templates_one_active_per_key
  on contract_composition_templates (key) where active = true;

insert into contract_composition_templates (key, version, title, body, required_vars, status, active)
values (
  'platform_commercial_annex', 1,
  'ANEXO I — CONDIÇÕES COMERCIAIS',
  'ANEXO I — CONDIÇÕES COMERCIAIS

Plano: {{planoNome}}
Mensalidade: R$ {{mensalidadeReais}}
Ciclo de cobrança: {{cicloCobranca}}
Vigência: {{vigencia}}
Permanência mínima: {{permanenciaMeses}} meses
Multa de rescisão antecipada: {{multaRescisao}}
Setup / implantação: {{setup}}
Reajuste: {{reajuste}}
Renovação: {{renovacao}}
Suporte: {{suporte}}

Usuários incluídos: {{usuariosIncluidos}}
Ativos incluídos: {{ativosIncluidos}}
Módulos incluídos: {{modulosIncluidos}}
Extensões contratadas: {{extensoesContratadas}}
Shinã AI Credits: {{aiCredits}} créditos/mês
Armazenamento: {{armazenamentoGb}} GB

Representante SHINÃ — Nome: {{representanteShinaNome}} | Cargo: {{representanteShinaCargo}}
Representante CONTRATANTE — Nome: {{representanteTenantNome}} | Cargo: {{representanteTenantCargo}}

Política de retenção de dados: {{retencaoResumo}}',
  array[
    'planoNome','mensalidadeReais','cicloCobranca','vigencia','permanenciaMeses',
    'multaRescisao','setup','reajuste','renovacao','suporte','usuariosIncluidos',
    'ativosIncluidos','modulosIncluidos','extensoesContratadas','aiCredits',
    'armazenamentoGb','representanteShinaNome','representanteShinaCargo',
    'representanteTenantNome','representanteTenantCargo','retencaoResumo'
  ],
  'published', true
)
on conflict (key, version) do nothing;

-- ── 3. onboarding_contract_snapshots (composed + frozen) ──────────────────
create table if not exists onboarding_contract_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  commercial_configuration_id uuid not null references commercial_configurations (id),
  business_profile_id uuid references business_profiles (id),
  contract_version_id uuid not null references contract_versions (id),
  composition_template_id uuid not null references contract_composition_templates (id),
  commercial_terms_snapshot_id uuid references commercial_terms_snapshots (id),
  execution_mode text not null default 'click_accept'
    check (execution_mode in ('click_accept', 'electronic_signature')),
  pricing_version integer,
  pricing jsonb not null default '{}'::jsonb,
  vars jsonb not null default '{}'::jsonb,
  composed_content text not null,
  content_hash text not null,
  readiness jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'frozen', 'superseded')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  frozen_at timestamptz
);
create index if not exists onboarding_contract_snapshots_tenant_idx
  on onboarding_contract_snapshots (tenant_id);
create index if not exists onboarding_contract_snapshots_config_idx
  on onboarding_contract_snapshots (commercial_configuration_id);
-- At most one FROZEN snapshot per commercial configuration — a re-priced
-- config must supersede and re-freeze, never mutate.
create unique index if not exists onboarding_contract_snapshots_one_frozen
  on onboarding_contract_snapshots (commercial_configuration_id) where status = 'frozen';

alter table onboarding_contract_snapshots enable row level security;
alter table onboarding_contract_snapshots force row level security;
create policy "onboarding_contract_snapshots_select" on onboarding_contract_snapshots
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ── 4. immutability guard — a frozen snapshot's sealed columns never change
create or replace function guard_frozen_onboarding_contract()
returns trigger language plpgsql as $$
begin
  if old.status = 'frozen' then
    if new.composed_content is distinct from old.composed_content
       or new.content_hash is distinct from old.content_hash
       or new.vars is distinct from old.vars
       or new.pricing is distinct from old.pricing
       or new.contract_version_id is distinct from old.contract_version_id
       or new.execution_mode is distinct from old.execution_mode then
      raise exception 'onboarding_contract_snapshots: a frozen snapshot is immutable (id=%)', old.id;
    end if;
    -- status may only move frozen -> superseded
    if new.status not in ('frozen', 'superseded') then
      raise exception 'onboarding_contract_snapshots: frozen snapshot can only be superseded (id=%)', old.id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_frozen_onboarding_contract_trg on onboarding_contract_snapshots;
create trigger guard_frozen_onboarding_contract_trg
  before update on onboarding_contract_snapshots
  for each row execute function guard_frozen_onboarding_contract();
