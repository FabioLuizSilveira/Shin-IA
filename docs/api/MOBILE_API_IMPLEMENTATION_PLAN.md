# Mobile API Implementation Plan

Data: 2026-08-15 · Depende da aprovação de [ADR_MOBILE_BFF.md](../adr/ADR_MOBILE_BFF.md) (recomendação:
BFF em `apps/web/src/app/api/mobile/*`, não em `apps/api`, para o lançamento inicial).

**Nenhuma destas waves foi implementada nesta auditoria.** Este documento é o plano proposto para
aprovação humana antes do início da implementação, conforme instrução do pedido original.

---

## Wave 1 — Foundation (P0)

Objetivo: o app consegue autenticar e saber onde está.

- `GET /api/mobile/bootstrap` — agrega `decodeSessionClaims()` + resolução de `userType`
  (`tenant_user`/`customer`/`operator`, ver gap MOB-002) + branding do tenant (reaproveitar
  `tenant-settings/company`) + permissões efetivas (via `hasTenantPermission()` chamado para cada chave
  do catálogo relevante, ou uma nova função em lote) + entitlements (reaproveitar
  `getEntitlements()` do `commercial-platform`).
- Estratégia de cache/ETag: como o payload muda pouco por sessão (branding/roles não mudam a cada
  minuto), recomenda-se um `ETag` fraco baseado em hash de `(tenant_id, updated_at de roles, updated_at
de branding)`, com o cliente reenviando `If-None-Match` — evita reprocessar a agregação inteira em
  todo cold-start do app. Não implementar cache no primeiro corte; documentar como melhoria de Wave 1.5.
- Regra obrigatória (ver ADR): toda rota nova aqui já nasce usando `hasTenantPermission()` +
  `scoped*` helpers.
- Decisão de produto pendente antes de codar: gap MOB-012 (self-cadastro no app mobile) — confirmar
  intenção antes de expor `/mobile/bootstrap` a qualquer usuário que conseguiu logar.

## Wave 2 — Core Operations (P0/P1)

- `GET /api/mobile/dashboard` — agregação leve de `/api/tenant-metrics` reformatada para cards mobile
  (não expor o payload web bruto sem revisão, ver gap MOB-015).
- Expor `/api/operations`, `/api/assets`, `/api/organizations` já existentes via o mesmo domínio
  `/api/mobile/*` só se o payload atual servir; senão, DTOs mobile-específicos que chamam os serviços de
  domínio internamente (nunca duplicam a query).
- `GET /api/mobile/customer-contracts` — lista de contratos do cliente logado (hoje o app mobile lê
  `contracts` direto via RLS; migrar para uma rota BFF só se o ganho de agregação compensar — caso
  contrário, manter leitura direta via Supabase como já funciona, documentado explicitamente como
  IMPLEMENTED-via-RLS, não uma lacuna).

## Wave 3 — Operational Services (P1/P2)

- `POST /api/mobile/customer-contracts/{id}/accept` — pode ser um alias fino sobre o
  `/api/customer-contracts/{id}/accept` já implementado, sem reescrever a lógica de aceite.
- `GET /api/mobile/customer-contracts/{id}/documents/{documentId}/url` — fecha o gap MOB-004
  (download de documento pelo cliente).
- `GET /api/mobile/tracking/{resourceId}/history` — fecha o gap MOB-003.
- `GET/PATCH /api/mobile/notifications` — alias sobre `/api/notifications` existente.

## Wave 4 — Business (P2/P3)

- Push notifications: nova tabela `device_push_tokens` + `POST/DELETE /api/mobile/devices` (gap
  MOB-007) — sem escolher provider (FCM/APNs/Expo Push) nesta fase, só o registro.
- `GET /api/mobile/invoices` — alias sobre `/api/invoices` já seguro para leitura.
- `GET /api/operators/{id}/assignments` (gap MOB-008).
- Reporting mobile-specific, se o payload de `/api/tenant-reports` não servir direto (Wave 2 já avalia
  isso — Wave 4 só entra se precisar de trabalho extra).

---

## Fora de escopo desta rodada de implementação (mas registrado)

- Migração de `apps/api` para Railway como home real do BFF — só se/quando houver gatilho de produto
  (ver ADR).
- Rate limiting distribuído (gap MOB-014) — necessário antes de qualquer deploy multi-instância real,
  não bloqueante para o MVP mobile em si.
- CORS explícito — necessário antes de `api.shinaia.com.br` existir como domínio separado; não
  bloqueante enquanto o BFF vive dentro de `apps/web`.
- Enforcement obrigatório de HMAC no webhook de tracking (gap MOB-011) — não é uma rota mobile-facing,
  prioridade de infra de ingestão, não de app.

## Recomendações adicionais (não implementadas nesta rodada)

**Geração de tipos** (Fase 24): recomenda-se `openapi-typescript` gerando tipos TS a partir de
`mobile-openapi.yaml`, consumidos tanto pelo app mobile quanto por qualquer client TS futuro — evita
DTOs duplicados manualmente entre backend e app. Não implementado nesta auditoria para não expandir
escopo; é um passo de baixo risco a ser adotado assim que o OpenAPI tiver as primeiras rotas `proposed`
implementadas de verdade.

**Validação de contrato em CI** (Fase 25): recomenda-se, quando o BFF começar a ser implementado,
adicionar ao pipeline: (1) lint/validação do OpenAPI a cada PR que o altere, (2) detecção de breaking
change comparando contra a versão em `main`, (3) geração automática de tipos como passo de build, (4)
testes de contrato básicos (schema da resposta real bate com o OpenAPI). Não implementado nesta
auditoria — alterar o pipeline de CI está fora do escopo de uma rodada de auditoria+especificação.
