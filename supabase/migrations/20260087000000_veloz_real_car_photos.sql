-- Replaces the generic Unsplash stock photos (visual placeholders reused
-- from the Emergent mock fleet, matched by vibe/tier rather than actual
-- model) with real photos of each specific car model/trim, sourced from
-- Wikimedia Commons (freely licensed, stable hotlink via Special:FilePath).
-- ?width=500 requests a thumbnail rather than the full-resolution original —
-- Wikimedia's own CDN rate-limits/rejects programmatic hotlinking of
-- full-res originals and asks callers to use a thumbnail size instead.
update assets set metadata = metadata || '{"photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Onix_(second_generation,_front_view).jpg?width=500"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000005'; -- Chevrolet Onix
update assets set metadata = metadata || '{"photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/2018_Volkswagen_Polo_SE_TSi_1.0_Front.jpg?width=500"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000006'; -- Volkswagen Polo
update assets set metadata = metadata || '{"photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/2023_Hyundai_HB20_1.0_T-GDi_Platinum_Plus_(Brazil)_front_view.png?width=500"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000007'; -- Hyundai HB20
update assets set metadata = metadata || '{"photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/Jeep_Compass_(MP)_Facelift_IMG_5813.jpg?width=500"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000008'; -- Jeep Compass
update assets set metadata = metadata || '{"photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/BMW_320i_2017_Base_Sedan_Front.jpg?width=500"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000009'; -- BMW 320i
update assets set metadata = metadata || '{"photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/Volkswagen_Voyage_1.6_Power_2014_(12664254193).jpg?width=500"}'::jsonb
  where id = '5000000a-0000-0000-0000-000000000001'; -- Volkswagen Voyage
update assets set metadata = metadata || '{"photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/2023_Toyota_Corolla_Altis_1.8_Sport.jpg?width=500"}'::jsonb
  where id = '5000000b-0000-0000-0000-000000000001'; -- Toyota Corolla
update assets set metadata = metadata || '{"photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/2023_Honda_Civic_Sport_Sedan_in_Rallye_Red,_Front_Left,_04-07-2023.jpg?width=500"}'::jsonb
  where id = '5000000c-0000-0000-0000-000000000001'; -- Honda Civic
