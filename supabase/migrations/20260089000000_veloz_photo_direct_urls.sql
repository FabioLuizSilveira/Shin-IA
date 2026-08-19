-- The Special:FilePath?width=500 URLs from the previous two migrations
-- resolve correctly via curl -L (302 -> 301 -> 200), but React Native's
-- image loader on Android doesn't reliably follow that two-hop redirect
-- chain across domains (commons.wikimedia.org -> upload.wikimedia.org) —
-- images never rendered on device despite the URL itself being valid.
-- Switching to the final upload.wikimedia.org thumbnail URL directly (a
-- single 200 OK, no redirect at all) removes that failure mode entirely.
-- Same photos, same thumbnail size — only the URL shape changed.
update assets set metadata = metadata || '{"photo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Chevrolet_Onix_%28second_generation%2C_front_view%29.jpg/500px-Chevrolet_Onix_%28second_generation%2C_front_view%29.jpg"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000005'; -- Chevrolet Onix
update assets set metadata = metadata || '{"photo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/2018_Volkswagen_Polo_SE_TSi_1.0_Front.jpg/500px-2018_Volkswagen_Polo_SE_TSi_1.0_Front.jpg"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000006'; -- Volkswagen Polo
update assets set metadata = metadata || '{"photo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/2023_Hyundai_HB20_1.0_T-GDi_Platinum_Plus_%28Brazil%29_front_view.png/500px-2023_Hyundai_HB20_1.0_T-GDi_Platinum_Plus_%28Brazil%29_front_view.png"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000007'; -- Hyundai HB20
update assets set metadata = metadata || '{"photo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Jeep_Compass_%28MP%29_Facelift_IMG_5813.jpg/500px-Jeep_Compass_%28MP%29_Facelift_IMG_5813.jpg"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000008'; -- Jeep Compass
update assets set metadata = metadata || '{"photo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/BMW_320i_2017_Base_Sedan_Front.jpg/500px-BMW_320i_2017_Base_Sedan_Front.jpg"}'::jsonb
  where id = '50000000-0000-0000-0000-000000000009'; -- BMW 320i
update assets set metadata = metadata || '{"photo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Volkswagen_Voyage_1.6_Power_2014_%2812664254193%29.jpg/500px-Volkswagen_Voyage_1.6_Power_2014_%2812664254193%29.jpg"}'::jsonb
  where id = '5000000a-0000-0000-0000-000000000001'; -- Volkswagen Voyage
update assets set metadata = metadata || '{"photo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/2023_Toyota_Corolla_Altis_1.8_Sport.jpg/500px-2023_Toyota_Corolla_Altis_1.8_Sport.jpg"}'::jsonb
  where id = '5000000b-0000-0000-0000-000000000001'; -- Toyota Corolla
update assets set metadata = metadata || '{"photo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/2023_Honda_Civic_Sport_Sedan_in_Rallye_Red%2C_Front_Left%2C_04-07-2023.jpg/500px-2023_Honda_Civic_Sport_Sedan_in_Rallye_Red%2C_Front_Left%2C_04-07-2023.jpg"}'::jsonb
  where id = '5000000c-0000-0000-0000-000000000001'; -- Honda Civic
