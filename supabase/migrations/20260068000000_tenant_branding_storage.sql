-- Storage bucket for tenant-uploaded branding assets (logo, favicon).
-- Public read (so the uploaded image can be rendered directly via its
-- public URL in <img> tags, including on the public-facing app chrome) —
-- writes only ever happen through the /api/tenant-studio/branding/upload
-- route, which authenticates via requireTenantScope() and uses the
-- service-role client, the same manual-tenant-scoping pattern already used
-- everywhere else in this codebase (see Obs-21 in tenant-context.ts) rather
-- than relying on storage.objects RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-branding',
  'tenant-branding',
  true,
  2097152, -- 2 MiB
  array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon']
)
on conflict (id) do nothing;
