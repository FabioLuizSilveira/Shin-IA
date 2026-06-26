# Deploy Guide — Shinã Platform

## 1. Supabase Cloud

1. Create project at [supabase.com](https://supabase.com)
2. Copy **Project URL** and **API Keys** from Settings → API
3. Link and push migrations:
   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```
4. Run seed (optional, for demo data):
   ```bash
   # Execute supabase/seed.sql in the SQL editor
   ```

## 2. Vercel — Admin Portal

1. Import repo at [vercel.com/new](https://vercel.com/new)
2. Set **Root Directory** → `apps/admin-web`
3. Framework preset → **Next.js** (auto-detected)
4. Environment variables:
   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase settings |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase settings |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase settings |
5. Deploy

## 3. Vercel — Tenant Portal

Same steps as admin, but:
- Root Directory → `apps/tenant-web`
- Add extra env var: `DEMO_TENANT_ID` → UUID of your demo tenant

## 4. Post-Deploy Checklist

- [ ] Login works on both apps
- [ ] `/api/health` returns `{ status: "healthy" }`
- [ ] Tenant-web dashboard loads real data
- [ ] Notifications bell shows (polling active)
- [ ] Reports page renders charts
