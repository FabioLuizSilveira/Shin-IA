-- M001: Enable required PostgreSQL extensions
-- pgcrypto: used for gen_random_bytes in seed/dev helpers (not PK generation)
-- uuid-ossp: fallback UUID utilities used by Supabase internals

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
