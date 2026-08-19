-- Three small fixes surfaced by testing the mobile app against the demo tenant:
--
-- 1. A leftover pending "delivery" operation from an earlier cross-tenant
--    security test (linked to the "Verify W2C Asset Mine" asset already
--    soft-deleted in 20260085000000) was still showing up in Operações —
--    soft-deleting the assets it referenced didn't touch the operation row
--    itself, and the join doesn't filter by the linked asset's deleted_at.
-- 2. The 8 maintenance operations seeded in 20260084000000 only carried
--    their note in metadata.description, never the real `description`
--    column the UI actually reads — so every one rendered with no text.
-- 3. Car photo URLs from Wikimedia Commons had raw parentheses/commas in
--    the path (valid per RFC 3986, but several mobile HTTP/URL parsers are
--    stricter) — causing images to silently fail to load on device even
--    though the URLs resolved fine via curl. Re-writing them fully
--    percent-encoded fixes that without changing which photo is used.

update operations
set deleted_at = now()
where tenant_id = '10000000-0000-0000-0000-000000000001'
  and asset_id = '4ae14e6f-eb9b-4b39-bc66-a9a057701e0d' -- "Verify W2C Asset Mine"
  and deleted_at is null;

update operations
set description = 'Revisão preventiva'
where tenant_id = '10000000-0000-0000-0000-000000000001'
  and type = 'maintenance'
  and description is null;

update assets set metadata = metadata || '{"photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Onix_%28second_generation%2C_front_view%29.jpg?width=500"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000005'; -- Chevrolet Onix
update assets set metadata = metadata || '{"photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/2018_Volkswagen_Polo_SE_TSi_1.0_Front.jpg?width=500"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000006'; -- Volkswagen Polo
update assets set metadata = metadata || '{"photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/2023_Hyundai_HB20_1.0_T-GDi_Platinum_Plus_%28Brazil%29_front_view.png?width=500"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000007'; -- Hyundai HB20
update assets set metadata = metadata || '{"photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/Jeep_Compass_%28MP%29_Facelift_IMG_5813.jpg?width=500"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000008'; -- Jeep Compass
update assets set metadata = metadata || '{"photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/BMW_320i_2017_Base_Sedan_Front.jpg?width=500"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000009'; -- BMW 320i
update assets set metadata = metadata || '{"photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/Volkswagen_Voyage_1.6_Power_2014_%2812664254193%29.jpg?width=500"}'::jsonb
  where id = '5000000a-0000-0000-0000-000000000001'; -- Volkswagen Voyage
update assets set metadata = metadata || '{"photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/2023_Toyota_Corolla_Altis_1.8_Sport.jpg?width=500"}'::jsonb
  where id = '5000000b-0000-0000-0000-000000000001'; -- Toyota Corolla
update assets set metadata = metadata || '{"photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/2023_Honda_Civic_Sport_Sedan_in_Rallye_Red%2C_Front_Left%2C_04-07-2023.jpg?width=500"}'::jsonb
  where id = '5000000c-0000-0000-0000-000000000001'; -- Honda Civic
