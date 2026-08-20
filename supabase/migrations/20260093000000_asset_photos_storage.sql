-- Storage bucket for tenant-uploaded asset photos (vehicles, equipment,
-- etc.), shown in tenant/assets and in the customer-facing rental screens
-- (mobile app + web portal). Same public-read, service-role-write pattern
-- as tenant-branding (20260068000000) — writes only ever happen through
-- /api/assets/[id]/photo, which authenticates via requireTenantScope().
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'asset-photos',
  'asset-photos',
  true,
  4194304, -- 4 MiB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;
