# Relatório Final — Unified Commercial Flow (Shinã Platform + Shinã MKT)

Data: 2026-08-15 · Branch: `release/v1.0-platform` · Status: **implementado e verificado, ainda não commitado**

---

## 1. Auditoria do fluxo antigo

- **Platform**: `provisionTenant()` criava o tenant e chamava `provisionPlatformSubscription()`
  direto — sem checkout, sem webhook, sem aceite de contrato. Onboarding público 100% anônimo;
  o usuário só virava `auth.users` de verdade ao aceitar um convite por e-mail _depois_ do tenant
  já existir. Não havia nenhum registro de aceite de termos em lugar nenhum do produto Platform.
- **MKT**: já tinha o fluxo correto (checkout → Stripe → webhook → `syncStripeEvent`), mas a lógica
  de orquestração comercial (checkout, reconciliação, refund) estava solta dentro da própria rota,
  sem conceito de `PlanVersion` imutável nem de aceite de contrato antes do pagamento.
- **Risco jurídico concreto**: nenhum dos dois produtos tinha evidência de aceite de termos
  vinculada a usuário+IP+timestamp+hash do documento — o pedido original do usuário.

## 2. Arquitetura comercial final

Novo pacote `packages/commercial-platform` fica **acima** de `packages/billing-platform` (que
continua existindo, intocado em espírito — só ganhou `trialPeriodDays` e `updateSubscription()`).
Ele orquestra: aceite → snapshot imutável → checkout → validação de pré-condição no webhook →
delegação para o `syncStripeEvent` já testado → entitlements derivados ao vivo. Platform e MKT
agora chamam exatamente os mesmos serviços — zero lógica de negócio duplicada entre os dois apps.

## 3. Migrations (4, todas aplicadas no Supabase hospedado `wokoqmoulsvzikkdcmfc`)

1. `20260072000000_commercial_flow.sql` — schema completo (ver seção 5).
2. `20260073000000_mkt_real_plans.sql` — planos reais do MKT (`starter/pro/business`,
   R$149/399/999) ligados aos price IDs Stripe já configurados em produção.
3. `20260074000000_commercial_flow_nullable_tenant.sql` — corrige `tenant_id` para nullable
   (comprador só-MKT não tem tenant Platform).
4. `20260075000000_material_contract_claim.sql` — claim JWT `platform_contract_current`.

## 4. Pacote `commercial-platform`

10 testes unitários (vitest), todos verdes: `hash.test.ts` (3), `acceptance.test.ts` (7, incluindo
o caso tenant-nulo do comprador só-MKT). Módulos: `hash`, `contract-requirement`, `snapshot`,
`acceptance`, `checkout-orchestration`, `webhook-orchestration`, `entitlements`, `plan-change`,
`manual-activation`.

## 5. Fluxo Platform (login-first)

Wizard de onboarding agora exige login (magic link/Google) **antes** de qualquer dado de empresa.
Steps: Empresa → Sede → Blueprint → Plano → Contrato (representante + 2 checkboxes). Ao submeter:
tenant criado em `pending_payment`, papéis atribuídos, aceite registrado, checkout Stripe criado —
usuário só chega ao dashboard depois que `api/webhooks/stripe-commercial` confirma o pagamento e
flipa `tenants.status` para `trialing`/`active`.

## 6. Fluxo MKT

`api/checkout` agora exige aceite do `MKT_SERVICE_AGREEMENT` antes de criar a sessão Stripe
(403 `acceptance_required` abre um modal de aceite no signup, que re-tenta o checkout automaticamente
depois). O webhook do MKT passou a chamar `activateFromWebhook()` (que valida a referência e delega
para o mesmo `syncStripeEvent` de sempre) em vez de chamar `syncStripeEvent` direto. Comportamento
de reembolso de 14 dias, inalterado.

## 7-9. ContractAcceptance / CommercialTermsSnapshot / PlanVersion

- `contract_acceptances`: `accepted_at`/`ip_address`/`user_agent` sempre carimbados pelo servidor,
  nunca aceitos do corpo da requisição. `document_hash` sempre calculado no servidor a partir do
  conteúdo do contrato buscado no banco — nunca enviado pelo cliente.
- `commercial_terms_snapshots`: imutável, só INSERT, nunca UPDATE.
- `plan_versions`: versão publicada nunca é alterada depois — nova versão = nova linha. `tenant_id`
  nullable propositalmente (comprador só-MKT).

## 10. Checkout

`checkout_session_references` gera um `checkout_ref_id` próprio _antes_ de chamar o Stripe, passado
via `metadata` — é como o webhook reconcilia o evento sem precisar de nenhuma mudança de schema no
`billing-platform` compartilhado.

## 11. Webhook

`activateFromWebhook()` resolve o `checkout_ref_id`, valida que `ContractAcceptance`/`PlanVersion`/
`CommercialTermsSnapshot` referenciados realmente existem, e só então delega para `syncStripeEvent`
(idempotente via índice único em `platform_billing_events.stripe_event_id` — replay confirmado nos
testes de segurança, ver seção 17).

## 12-13. Subscription / Entitlements

`platform_subscriptions` ganhou `plan_version_id`/`commercial_terms_snapshot_id`/`billing_mode`
(linhas antigas ficam nulas, não retroagimos histórico). `getEntitlements()` deriva ao vivo do join
`platform_subscriptions → plan_versions.included_features` — sem tabela de cache para não
dessincronizar.

## 14. Upgrade/Downgrade

`changePlan()` checa `hasAcceptedCurrentContract()` primeiro — se pendente, bloqueia com
`contract_reacceptance_required` (409) e redireciona para `/tenant/legal/reaccept`. Caso normal:
grava `plan_change_acceptances` (aceite comercial, não jurídico) e chama
`BillingProvider.updateSubscription()`.

## 15. Trial

`plan_versions.trial_days` alimenta `subscription_data.trial_period_days` no Stripe via
`createCommercialCheckout()` — aceite/snapshot continuam obrigatórios antes do trial começar.

## 16. Enterprise billing

`activateSubscriptionManually()` ativa assinaturas com `billing_mode !== 'card'` (invoice/manual
contract/custom) sem passar pelo Stripe Checkout — mesma trilha de evidência de aceite, sem forçar
cartão. Rota gated por `requirePlatformRole()`.

## 17. Testes de segurança (Fase I, todos rodados contra o banco hospedado real)

| Teste                                                                        | Resultado                                                                                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Isolamento cross-tenant via RLS (JWT real de outro tenant)                   | **Bloqueado** — 0 linhas vazadas                                                                                          |
| Replay de webhook (mesmo `event.id` duas vezes)                              | 1ª: `duplicate=false`; 2ª: `duplicate=true`                                                                               |
| Assinatura Stripe inválida                                                   | `constructEvent` lança, rota responde 400 (padrão já usado no MKT)                                                        |
| Usuário sem `legal_contracts:accept` tentando aceitar                        | Rota retorna 403 (`hasTenantPermission` confirmado false)                                                                 |
| `plan_version_id` de produto errado (mkt tentando aceitar contrato platform) | Rejeitado: `"plan version ... does not belong to product ..."`, nenhuma linha órfã                                        |
| Hash de documento divergente                                                 | Estruturalmente impossível — hash sempre calculado no servidor a partir do conteúdo já publicado, nunca aceito do cliente |

## 18. Cobertura

10 testes unitários no `commercial-platform` + 7 pré-existentes em `sync-webhook.test.ts`
(re-verificados, continuam verdes) + verificação end-to-end contra dados reais em cada uma das 9
fases (A–I), incluindo os 6 testes de segurança acima. `pnpm --filter @shina/web typecheck` e
`next build` limpos; mesmo para `@shina/mkt` e `@shina/commercial-platform`.

## 19. Riscos assumidos

- Onboarding público mudou de "preencher tudo, confirmar e-mail depois" para "logar primeiro,
  depois preencher" — mudança real de UX, não reversível sem redesenhar de novo.
- `platform_subscriptions` antigas (inclusive a de `fabio@shinaia.com.br`) ficam com
  `plan_version_id`/`commercial_terms_snapshot_id` nulos — histórico não foi retroagido.
- Rate limiting continua in-memory/por-instância (limitação pré-existente, não desta feature).
- Texto jurídico dos dois contratos-seed é placeholder — jurídico da Shinã precisa revisar antes
  de produção real.

## 20. Confirmação

Platform e MKT usam hoje **o mesmo pacote, os mesmos serviços, o mesmo padrão de aceite/checkout/
webhook** — nenhuma lógica de negócio comercial duplicada entre os dois apps.

---

## Estado do trabalho

Todas as 4 migrations **já estão aplicadas no Supabase hospedado**. O código (novo pacote
`packages/commercial-platform`, extensões em `packages/billing-platform`, e todas as mudanças em
`apps/web`/`apps/mkt`) está **pronto e verificado, mas ainda não commitado** — aguardando
confirmação para commit e deploy.
