# Engineering Principles — Shinã Platform

These principles guide every technical decision in this project.

---

## 1. Correctness First

Working software beats elegant software. A correct, readable solution is always preferred over a clever, brittle one. Handle errors explicitly — never swallow them silently.

## 2. TypeScript Strictly

All code is written in TypeScript with `strict: true`. The `any` type is banned except in rare, justified edge cases documented with a comment. Type inference is preferred over explicit annotations where the type is obvious.

## 3. Explicit over Implicit

Configuration, behavior, and side effects must be explicit and auditable. Avoid magic — if something isn't obvious from reading the code, it needs a comment explaining why, not what.

## 4. Small, Focused Packages

Each package in the monorepo has a single responsibility. If a package grows to cover multiple concerns, it must be split. Dependencies between internal packages are intentional and documented.

## 5. Fail Fast

Validate inputs at system boundaries (API routes, form submissions, CLI args). Trust internal code — don't add redundant null-checks inside modules that already guarantee valid state.

## 6. No Premature Abstraction

Three similar files is better than a wrong abstraction. Abstract only when:
- The same pattern appears 3+ times
- The abstraction has a clear, stable name
- It reduces complexity rather than adding it

## 7. Security by Default

- No secrets in code or git history
- Supabase Row Level Security (RLS) enabled on all tables
- All user input validated and sanitized
- Dependencies audited regularly with `pnpm audit`

## 8. Performance is a Feature

- Avoid N+1 queries
- Prefer server-side data fetching over client waterfalls
- Use Turborepo remote cache to keep CI fast
- Bundle size is measured and budgeted per app

## 9. Documentation as Code

- Every architectural decision gets an ADR in `docs/adr/`
- Public package APIs are documented with JSDoc
- `CLAUDE.md` is kept accurate — stale instructions are worse than none

## 10. CI is the Authority

If it passes locally but fails CI — CI wins. Fix the root cause. Never bypass hooks or CI checks.

---

## Conventions

### Naming

| Context | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `user-profile.ts` |
| React components | PascalCase | `UserProfile.tsx` |
| Functions / variables | camelCase | `getUserProfile` |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_COUNT` |
| Database columns | snake_case | `created_at` |
| CSS classes | kebab-case | `user-profile-card` |

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(auth): add OAuth2 login with Google
fix(api): handle null response from Supabase
docs: update README with environment variables
```

Scopes are optional but encouraged for clarity.

### Branch Strategy

```
main        → production
develop     → integration branch
feat/*      → feature branches
fix/*       → bug fix branches
chore/*     → maintenance
```

PRs always target `develop`. Only release commits go to `main`.
