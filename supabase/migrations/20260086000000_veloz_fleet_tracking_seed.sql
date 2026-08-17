-- The Veloz Rent a Car demo tenant had zero `resources`/`resource_locations`
-- rows, so tenant/tracking's fleet map (both the web page and the new
-- mobile TrackingScreen) rendered empty regardless of platform — there was
-- nothing to show, not a display bug. Seeds one `resources` row per car
-- (mirrors the 8 `assets` rows 1:1 by plate/model — resources and assets are
-- separate, unlinked tables in this schema, see 20260066000000's comment)
-- plus one recent GPS ping each, scattered around São Paulo (where the
-- tenant's customers are seeded), so the map has real markers to draw.
insert into resources (id, tenant_id, branch_id, name, type, status, metadata) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Chevrolet Onix - ABC1D23', 'vehicle', 'busy', '{"asset_id": "50000000-0000-0000-0000-000000000005"}'::jsonb),
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Volkswagen Polo - BCD2E34', 'vehicle', 'busy', '{"asset_id": "50000000-0000-0000-0000-000000000006"}'::jsonb),
  ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Hyundai HB20 - CDE3F45', 'vehicle', 'available', '{"asset_id": "50000000-0000-0000-0000-000000000007"}'::jsonb),
  ('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Jeep Compass - DEF4G56', 'vehicle', 'available', '{"asset_id": "50000000-0000-0000-0000-000000000008"}'::jsonb),
  ('60000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'BMW 320i - EFG5H67', 'vehicle', 'busy', '{"asset_id": "50000000-0000-0000-0000-000000000009"}'::jsonb),
  ('60000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Volkswagen Voyage - FGH6I78', 'vehicle', 'available', '{"asset_id": "5000000a-0000-0000-0000-000000000001"}'::jsonb),
  ('60000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Toyota Corolla - GHI7J89', 'vehicle', 'busy', '{"asset_id": "5000000b-0000-0000-0000-000000000001"}'::jsonb),
  ('60000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Honda Civic - HIJ8K90', 'vehicle', 'available', '{"asset_id": "5000000c-0000-0000-0000-000000000001"}'::jsonb)
on conflict (id) do nothing;

insert into resource_locations (tenant_id, resource_id, latitude, longitude, recorded_at, source) values
  ('10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', -23.561684, -46.655981, now() - interval '5 minutes', 'demo_seed'),
  ('10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', -23.550520, -46.633308, now() - interval '12 minutes', 'demo_seed'),
  ('10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', -23.579233, -46.639287, now() - interval '3 minutes', 'demo_seed'),
  ('10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000004', -23.533773, -46.625290, now() - interval '20 minutes', 'demo_seed'),
  ('10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000005', -23.593701, -46.684927, now() - interval '8 minutes', 'demo_seed'),
  ('10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000006', -23.564389, -46.652779, now() - interval '15 minutes', 'demo_seed'),
  ('10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000007', -23.545845, -46.638128, now() - interval '2 minutes', 'demo_seed'),
  ('10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000008', -23.571234, -46.691456, now() - interval '25 minutes', 'demo_seed')
on conflict do nothing;
