# Roadmap — Shinã Platform

High-level product roadmap. Updated as milestones complete and priorities shift.

---

## Phase 1: Foundation (Milestones 1–2)

**Goal:** A working monorepo with a running application that can be deployed.

- Robust developer experience: hot reload, type safety, linting, formatting
- CI/CD pipeline catching regressions before merge
- Application shell ready for feature development

---

## Phase 2: Data & Identity (Milestones 3–4)

**Goal:** Users can create accounts and interact with persistent data.

- Supabase database live with schema
- Authentication flows (email, OAuth)
- Secure data access with RLS

---

## Phase 3: Core Product (Milestone 5)

**Goal:** The primary value proposition of the platform is implemented.

- Core domain features
- API layer
- Real-time capabilities (if applicable)

---

## Phase 4: Launch (Milestone 6)

**Goal:** Production-ready — performant, accessible, monitored.

- Performance meets Core Web Vitals thresholds
- Accessibility meets WCAG 2.1 AA
- Error monitoring and alerting configured
- Automated E2E test suite

---

## Backlog

Items identified but not yet scheduled:

- Internationalization (i18n)
- Mobile application (React Native / Expo)
- Admin dashboard
- Public API with rate limiting
- Webhook system

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-20 | Turborepo for monorepo | Industry standard, excellent DX, remote cache |
| 2026-06-20 | pnpm for package management | Fast, strict, disk-efficient |
| 2026-06-20 | Supabase for backend | Postgres + Auth + Realtime in one platform |
| 2026-06-20 | Next.js App Router | Server-first, RSC, streaming |
