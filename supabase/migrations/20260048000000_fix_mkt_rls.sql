-- Migration 20260048000000: Fix Marketing Module RLS Policies
-- This migration updates RLS policies for all marketing tables (mkt_*) to support both the custom token hook root claim and the standard app_metadata fallback for tenant_id.

-- 1. Helper function for resolving the current tenant ID from JWT robustly
create or replace function public.mkt_current_tenant_id()
returns uuid
language sql stable security definer
as $$
  select coalesce(
    (auth.jwt() ->> 'tenant_id')::uuid,
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );
$$;

-- ── mkt_workspaces ──────────────────────────────────────────────────────────
drop policy if exists "mkt_workspaces_select" on mkt_workspaces;
drop policy if exists "mkt_workspaces_insert" on mkt_workspaces;
drop policy if exists "mkt_workspaces_update" on mkt_workspaces;

create policy "mkt_workspaces_select" on mkt_workspaces for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_workspaces_insert" on mkt_workspaces for insert to authenticated
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_workspaces_update" on mkt_workspaces for update to authenticated
  using (tenant_id = public.mkt_current_tenant_id())
  with check (tenant_id = public.mkt_current_tenant_id());

-- ── mkt_brand_kits ──────────────────────────────────────────────────────────
drop policy if exists "mkt_brand_kits_select" on mkt_brand_kits;
drop policy if exists "mkt_brand_kits_insert" on mkt_brand_kits;
drop policy if exists "mkt_brand_kits_update" on mkt_brand_kits;
drop policy if exists "mkt_brand_kits_delete" on mkt_brand_kits;

create policy "mkt_brand_kits_select" on mkt_brand_kits for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_brand_kits_insert" on mkt_brand_kits for insert to authenticated
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_brand_kits_update" on mkt_brand_kits for update to authenticated
  using (tenant_id = public.mkt_current_tenant_id())
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_brand_kits_delete" on mkt_brand_kits for delete to authenticated
  using (tenant_id = public.mkt_current_tenant_id());

-- ── mkt_drafts ──────────────────────────────────────────────────────────────
drop policy if exists "mkt_drafts_select" on mkt_drafts;
drop policy if exists "mkt_drafts_insert" on mkt_drafts;
drop policy if exists "mkt_drafts_update" on mkt_drafts;

create policy "mkt_drafts_select" on mkt_drafts for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_drafts_insert" on mkt_drafts for insert to authenticated
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_drafts_update" on mkt_drafts for update to authenticated
  using (tenant_id = public.mkt_current_tenant_id())
  with check (tenant_id = public.mkt_current_tenant_id());

-- ── mkt_audit_trail ─────────────────────────────────────────────────────────
drop policy if exists "mkt_audit_trail_select" on mkt_audit_trail;
drop policy if exists "mkt_audit_trail_insert" on mkt_audit_trail;

create policy "mkt_audit_trail_select" on mkt_audit_trail for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_audit_trail_insert" on mkt_audit_trail for insert to authenticated
  with check (tenant_id = public.mkt_current_tenant_id());

-- ── mkt_ai_providers ────────────────────────────────────────────────────────
drop policy if exists "mkt_ai_providers_select" on mkt_ai_providers;
drop policy if exists "mkt_ai_providers_insert" on mkt_ai_providers;
drop policy if exists "mkt_ai_providers_update" on mkt_ai_providers;
drop policy if exists "mkt_ai_providers_delete" on mkt_ai_providers;

create policy "mkt_ai_providers_select" on mkt_ai_providers for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_ai_providers_insert" on mkt_ai_providers for insert to authenticated
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_ai_providers_update" on mkt_ai_providers for update to authenticated
  using (tenant_id = public.mkt_current_tenant_id())
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_ai_providers_delete" on mkt_ai_providers for delete to authenticated
  using (tenant_id = public.mkt_current_tenant_id());

-- ── mkt_ai_usage ────────────────────────────────────────────────────────────
drop policy if exists "mkt_ai_usage_select" on mkt_ai_usage;
drop policy if exists "mkt_ai_usage_insert" on mkt_ai_usage;

create policy "mkt_ai_usage_select" on mkt_ai_usage for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_ai_usage_insert" on mkt_ai_usage for insert to authenticated
  with check (tenant_id = public.mkt_current_tenant_id());

-- ── mkt_ad_library_entries ──────────────────────────────────────────────────
drop policy if exists "mkt_ad_library_select" on mkt_ad_library_entries;
drop policy if exists "mkt_ad_library_insert" on mkt_ad_library_entries;
drop policy if exists "mkt_ad_library_update" on mkt_ad_library_entries;
drop policy if exists "mkt_ad_library_delete" on mkt_ad_library_entries;

create policy "mkt_ad_library_select" on mkt_ad_library_entries for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_ad_library_insert" on mkt_ad_library_entries for insert to authenticated
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_ad_library_update" on mkt_ad_library_entries for update to authenticated
  using (tenant_id = public.mkt_current_tenant_id())
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_ad_library_delete" on mkt_ad_library_entries for delete to authenticated
  using (tenant_id = public.mkt_current_tenant_id());

-- ── mkt_swipe_files ─────────────────────────────────────────────────────────
drop policy if exists "mkt_swipe_files_select" on mkt_swipe_files;
drop policy if exists "mkt_swipe_files_insert" on mkt_swipe_files;
drop policy if exists "mkt_swipe_files_delete" on mkt_swipe_files;

create policy "mkt_swipe_files_select" on mkt_swipe_files for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_swipe_files_insert" on mkt_swipe_files for insert to authenticated
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_swipe_files_delete" on mkt_swipe_files for delete to authenticated
  using (tenant_id = public.mkt_current_tenant_id());

-- ── mkt_competitor_monitors ─────────────────────────────────────────────────
drop policy if exists "mkt_competitors_select" on mkt_competitor_monitors;
drop policy if exists "mkt_competitors_insert" on mkt_competitor_monitors;
drop policy if exists "mkt_competitors_update" on mkt_competitor_monitors;
drop policy if exists "mkt_competitors_delete" on mkt_competitor_monitors;

create policy "mkt_competitors_select" on mkt_competitor_monitors for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_competitors_insert" on mkt_competitor_monitors for insert to authenticated
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_competitors_update" on mkt_competitor_monitors for update to authenticated
  using (tenant_id = public.mkt_current_tenant_id())
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_competitors_delete" on mkt_competitor_monitors for delete to authenticated
  using (tenant_id = public.mkt_current_tenant_id());

-- ── mkt_generated_ads ───────────────────────────────────────────────────────
drop policy if exists "mkt_generated_ads_select" on mkt_generated_ads;
drop policy if exists "mkt_generated_ads_insert" on mkt_generated_ads;
drop policy if exists "mkt_generated_ads_update" on mkt_generated_ads;
drop policy if exists "mkt_generated_ads_delete" on mkt_generated_ads;

create policy "mkt_generated_ads_select" on mkt_generated_ads for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_generated_ads_insert" on mkt_generated_ads for insert to authenticated
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_generated_ads_update" on mkt_generated_ads for update to authenticated
  using (tenant_id = public.mkt_current_tenant_id())
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_generated_ads_delete" on mkt_generated_ads for delete to authenticated
  using (tenant_id = public.mkt_current_tenant_id());

-- ── mkt_cloned_ads ──────────────────────────────────────────────────────────
drop policy if exists "mkt_cloned_ads_select" on mkt_cloned_ads;
drop policy if exists "mkt_cloned_ads_insert" on mkt_cloned_ads;
drop policy if exists "mkt_cloned_ads_update" on mkt_cloned_ads;
drop policy if exists "mkt_cloned_ads_delete" on mkt_cloned_ads;

create policy "mkt_cloned_ads_select" on mkt_cloned_ads for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_cloned_ads_insert" on mkt_cloned_ads for insert to authenticated
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_cloned_ads_update" on mkt_cloned_ads for update to authenticated
  using (tenant_id = public.mkt_current_tenant_id())
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_cloned_ads_delete" on mkt_cloned_ads for delete to authenticated
  using (tenant_id = public.mkt_current_tenant_id());

-- ── mkt_campaigns ───────────────────────────────────────────────────────────
drop policy if exists "mkt_campaigns_select" on mkt_campaigns;
drop policy if exists "mkt_campaigns_insert" on mkt_campaigns;
drop policy if exists "mkt_campaigns_update" on mkt_campaigns;
drop policy if exists "mkt_campaigns_delete" on mkt_campaigns;

create policy "mkt_campaigns_select" on mkt_campaigns for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_campaigns_insert" on mkt_campaigns for insert to authenticated
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_campaigns_update" on mkt_campaigns for update to authenticated
  using (tenant_id = public.mkt_current_tenant_id())
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_campaigns_delete" on mkt_campaigns for delete to authenticated
  using (tenant_id = public.mkt_current_tenant_id());

-- ── mkt_ads ─────────────────────────────────────────────────────────────────
drop policy if exists "mkt_ads_select" on mkt_ads;
drop policy if exists "mkt_ads_insert" on mkt_ads;
drop policy if exists "mkt_ads_update" on mkt_ads;
drop policy if exists "mkt_ads_delete" on mkt_ads;

create policy "mkt_ads_select" on mkt_ads for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_ads_insert" on mkt_ads for insert to authenticated
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_ads_update" on mkt_ads for update to authenticated
  using (tenant_id = public.mkt_current_tenant_id())
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_ads_delete" on mkt_ads for delete to authenticated
  using (tenant_id = public.mkt_current_tenant_id());

-- ── mkt_ad_integrations ─────────────────────────────────────────────────────
drop policy if exists "mkt_integrations_select" on mkt_ad_integrations;
drop policy if exists "mkt_integrations_insert" on mkt_ad_integrations;
drop policy if exists "mkt_integrations_update" on mkt_ad_integrations;
drop policy if exists "mkt_integrations_delete" on mkt_ad_integrations;

create policy "mkt_integrations_select" on mkt_ad_integrations for select to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_integrations_insert" on mkt_ad_integrations for insert to authenticated
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_integrations_update" on mkt_ad_integrations for update to authenticated
  using (tenant_id = public.mkt_current_tenant_id())
  with check (tenant_id = public.mkt_current_tenant_id());
create policy "mkt_integrations_delete" on mkt_ad_integrations for delete to authenticated
  using (tenant_id = public.mkt_current_tenant_id());
