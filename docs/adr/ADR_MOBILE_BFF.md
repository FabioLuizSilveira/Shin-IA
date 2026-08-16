# ADR — Mobile BFF: onde e se construir

**Status**: ACCEPTED · **Data**: 2026-08-15 (aprovado pelo usuário na especificação Wave 0/Wave 1)

**Decisão**: Mobile BFF initially implemented in `apps/web`. Migration to `apps/api`/Railway
deferred until security parity and contract tests exist. `apps/api` continua reservado para
consolidação/migração futura, controlada — não usado nesta wave para evitar regressão de
segurança (a stack de IAM/tenant-context/autorização já está integrada e testada em `apps/web`;
portá-la para Fastify sem os mesmos testes é o risco real que esta decisão evita).

## Contexto

O usuário pediu para avaliar se devemos construir uma camada `/mobile/*` como Backend-for-Frontend, e
onde. A auditoria revelou um fato central que muda a resposta: **`apps/api` já existe** — é um servidor
Fastify standalone, deploy configurado via Railway (`apps/api/railway.toml`), exatamente batendo com o
diagrama de arquitetura-alvo do usuário (`api.shinaia.com.br` → Backend/Railway). Mas hoje ele só expõe
`GET /health` — nenhuma lógica de negócio foi portada para lá. **Toda** a IAM real
(`requireTenantScope()`, `hasTenantPermission()`, os ~80 filtros manuais de tenant, os dois engines de
contrato, billing, tracking) vive hoje em `apps/web` (Next.js, deploy Vercel).

Isso cria uma tensão real entre o diagrama-alvo e o estado atual, que precisa ser resolvida
explicitamente antes de escrever a primeira linha do BFF.

## Opções avaliadas

**A) Mobile consome as APIs atuais de `apps/web` diretamente** (sem BFF) — descartado: exigiria o
mobile fazer 5-8 round trips para montar uma única tela (ex.: dashboard precisa de tenant + métricas +
operações + notificações), muitas rotas retornam payloads formatados para tabela web (não para cards
mobile), e nenhuma rota resolve hoje "quem sou eu" (`userType`) de forma unificada — o cliente teria que
saber de antemão se é `rental_customers` ou `operators` para escolher qual API chamar.

**B) BFF dentro de `apps/api` (Fastify/Railway)** — bate com o diagrama-alvo do usuário, mas exige
**portar** `requireTenantScope()`, `hasTenantPermission()`, `decodeSessionClaims()`, e toda a lógica de
resolução de tenant/IAM do Next.js para Fastify — reimplementando, não reaproveitando, a camada mais
sensível a bugs de segurança do sistema (RLS é bypassada nessas rotas por design; um erro na porta é um
IDOR). Ver [MOBILE_SECURITY_REVIEW.md](../api/MOBILE_SECURITY_REVIEW.md) — a auditoria já encontrou que
essa camada tem pontos frágeis mesmo na implementação original (só 6 rotas usam `hasTenantPermission`
apesar de existir há tempo); reescrevê-la do zero em outro runtime sem os mesmos testes/histórico de
produção é um risco real de regressão de segurança, não hipotético.

**C) BFF como `/api/mobile/*` dentro de `apps/web`** — reaproveita 100% do `requireTenantScope()`/
`hasTenantPermission()`/`decodeSessionClaims()` existentes, zero porte, zero risco de regressão de
segurança na camada mais crítica. Não bate com o diagrama-alvo literal (`api.shinaia.com.br` separado),
mas pode ser exposto sob esse domínio depois via proxy/rewrite se necessário, sem reescrever a lógica.

## Decisão

**Opção C**, aprovada e implementada: `/api/mobile/*` dentro de `apps/web`, reaproveitando a stack de
IAM/tenant-context existente sem porte — `requireMobileContext()` delega ao mesmo
`getActiveImpersonation()`/claims-decoding que `requireTenantScope()` já usa; `hasTenantPermission()`/
`scopedSelect`/etc. continuam sendo os mesmos, sem cópia. `apps/api`/Railway é o destino de uma
migração futura, deliberada e testada, quando (e se) houver um gatilho real de produto para
desacoplar do Vercel — não um pré-requisito para o lançamento mobile. Primeiro endpoint real sob esse
padrão: `GET /api/mobile/bootstrap` (Wave 1), verificado contra o banco hospedado real.

Wave 2 confirmou o padrão em produção: `dashboard`, `operations` (lista+detalhe com
`allowedActions`/contract gate server-computed), `assets` (lista+detalhe) e os self-context
`customers/me`/`operators/me` seguem a mesma regra de reutilização — rotas novas só existem onde
`requireTenantScope()` rejeita estruturalmente a identidade (customer/operator); `tenant_user`
continua usando as rotas de staff já existentes (`/api/organizations`, `/api/operators`) sem
duplicação.

## Regras para o BFF (aplicadas, não só recomendadas)

Conforme já estabelecido no pedido original:

- BFF **não pode duplicar regra de negócio** — só autentica contexto, agrega, transforma DTO, e reduz
  round trips.
- Toda rota nova do BFF **deve** chamar `hasTenantPermission()`, nunca só `isTenantAdmin()` (ver gap
  MOB-009) — é a chance de consertar a inconsistência de autorização por construção, não de herdá-la.
- Toda rota nova do BFF **deve** usar os helpers `scopedSelect`/`scopedUpdate`/etc. já existentes em
  `tenant-context.ts`, nunca filtro `.eq()` solto (ver gap MOB-010).
- `tenant_id`/`role`/`permission`/`entitlement`/`price`/`subscription_status`/`contract_status` nunca
  são aceitos do corpo da requisição do mobile — sempre resolvidos server-side a partir da sessão.

## Consequências

- Onboarding do app mobile não fica bloqueado por uma reescrita de IAM em outro runtime.
- `apps/api` continua existindo como esqueleto correto para uma migração futura — não precisa ser
  descartado, só não é o caminho crítico agora.
- Se a decisão for revertida depois (mover pra `apps/api`), o contrato OpenAPI construído nesta
  auditoria permanece válido — é a implementação que muda de lugar, não a interface.

## Condição para migração futura para `apps/api` (Wave 4 Phase D)

Ainda **não migrar** — mas a migração só deve ser considerada aprovada quando **todos** os itens
abaixo estiverem satisfeitos, não apenas "o Fastify skeleton existe":

1. **Paridade de autorização** — `apps/api` reimplementa `hasTenantPermission()`,
   `resolveMobileContext()`/`requireMobileContext()`, e todo o conjunto de `mobile-*-scope.ts`
   (operations/assets/contracts/tracking/billing) com o mesmo comportamento, não uma versão
   simplificada.
2. **Paridade de tenant context** — `requireTenantScope()`/`scopedSelect`/`scopedUpdate` e o
   decodificador de claims (`decodeSessionClaims`) portados sem divergência de semântica
   (getSession() vs getUser(), branch scope, impersonation).
3. **Contract tests** — o novo runtime validado contra o mesmo `mobile-openapi.yaml`, não apenas
   "parece funcionar" manualmente.
4. **Testes de integração** — cobertura equivalente aos testes ao vivo já rodados nesta sessão
   (isolamento cross-tenant/cross-customer/cross-operator, IDOR, anti-tamper) rodando contra
   `apps/api`, não só contra `apps/web`.
5. **Validação de segurança sem regressão** — nenhuma das descobertas fechadas nesta sessão (ex.
   path traversal em upload de documento, `operations:write` sem enforcement) pode reabrir na nova
   implementação.

Enquanto qualquer um desses itens não estiver satisfeito, `apps/api` permanece fora do caminho
crítico — não é uma proibição permanente, é um gate de qualidade.
