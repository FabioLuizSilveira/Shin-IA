-- Platform Sales CRM — controla o processo de captação/evolução de leads
-- comerciais da própria Shinã (prospects que podem virar tenants), na
-- sessão plataforma (staff Shinã), separado do CRM de cliente/organização
-- que já existe por tenant (tenant/crm, "Clientes & Parceiros" — aquele é
-- o cliente FINAL de cada locadora, este aqui é o cliente da própria
-- Shinã: uma locadora em potencial).
--
-- Segue o padrão já confirmado para tudo que é platform-side neste
-- projeto (platform_permissions/platform_role_permissions,
-- platform_user_roles, impersonation-sessions): sem RLS, "only accessible
-- via service role" — toda rota autentica via requirePlatformRole() e usa
-- o admin client, exatamente como POST/GET /api/tenants já faz. Nenhuma
-- rota platform-side existente hoje impõe checagem de permission key fina
-- (platform_permissions/platform_role_permissions existem só pra UI de
-- configuração de papéis, nunca são lidos por uma rota real) — este
-- módulo não inventa um sistema de enforcement que mais nada usa; segue
-- o requirePlatformRole() simples, mesmo padrão real de todo o resto.
--
-- assigned_to/created_by/converted_by são o auth.users.id (uuid) direto
-- do staff Shinã, sem tabela de perfil própria — platform_user_roles já
-- faz o mesmo (comentário: "platform user from Supabase Auth or external
-- system"), sem FK (Auth não é uma tabela do schema public), resolvido
-- via admin.auth.admin.getUserById() na camada de API quando precisar
-- exibir e-mail/nome, mesmo padrão de platform-settings/
-- impersonation-sessions.

create type crm_lead_status as enum (
  'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'
);

create type crm_lead_source as enum (
  'website', 'referral', 'outbound', 'event', 'social', 'partner', 'other'
);

create type crm_activity_type as enum (
  'note', 'call', 'email', 'meeting', 'status_change'
);

create table crm_leads (
  id uuid primary key default gen_random_uuid(),

  company_name text not null,
  contact_name text not null,
  contact_email text,
  contact_phone text,

  source crm_lead_source not null default 'other',
  status crm_lead_status not null default 'new',

  segment text, -- vertical livre: "locadora de carros", "guindastes", etc.
  estimated_fleet_size integer,
  estimated_mrr_cents integer, -- valor mensal estimado do negócio, não cobrança real

  assigned_to uuid, -- auth.users.id do staff Shinã responsável, nullable (não atribuído)
  lost_reason text, -- só relevante quando status = 'lost', nunca obrigatório

  -- Preenchido só quando o lead vira um tenant real (conversion, ver
  -- POST /api/platform-crm/leads/:id/convert) -- nunca setado manualmente.
  converted_tenant_id uuid references tenants (id) on delete set null,
  converted_at timestamptz,
  converted_by uuid,

  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index crm_leads_status_idx on crm_leads (status) where deleted_at is null;
create index crm_leads_assigned_to_idx on crm_leads (assigned_to) where deleted_at is null;
create index crm_leads_created_at_idx on crm_leads (created_at desc);
create unique index crm_leads_converted_tenant_id_idx
  on crm_leads (converted_tenant_id) where converted_tenant_id is not null;

-- Log de evolução do lead (item central do pedido: "controlar o processo
-- de captação/evolução") -- toda nota, ligação, e-mail, reunião ou
-- mudança de status vira uma linha aqui, nunca sobrescreve a anterior.
create table crm_lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references crm_leads (id) on delete cascade,
  type crm_activity_type not null,
  description text not null,
  -- Preenchidos só quando type = 'status_change', pela própria rota que
  -- muda o status -- nunca editável manualmente via activities.
  from_status crm_lead_status,
  to_status crm_lead_status,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create index crm_lead_activities_lead_id_idx on crm_lead_activities (lead_id, created_at desc);

-- Sem RLS -- ver comentário no topo do arquivo.
