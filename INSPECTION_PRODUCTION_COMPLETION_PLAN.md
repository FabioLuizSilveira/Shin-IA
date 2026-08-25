# Inspection Engine — Production Completion Plan (V1 Comercial)

Discovery real (código + banco hospedado), não o relatório anterior, é a fonte usada aqui.
Três auditorias paralelas confirmaram o estado abaixo em 2026-08-25.

## 1. Estado atual confirmado

**Persona `operator` já existe de verdade** (mais madura do que o spec presumia):

- Tabela `operators` + `operator_assignments` (`20260076000000_tenant_contract_engine.sql`),
  RLS por `auth_user_id = auth.uid()`.
- `requireMobileContext()` (`apps/web/src/lib/mobile-context.ts:195-217`) já resolve
  `UserType = "tenant_user" | "customer" | "operator" | "unprovisioned"` como union taggeada —
  operator não é bolt-on, é um branch de primeira classe já resolvido via
  `operators.auth_user_id`.
- Mobile já tem `OperatorHomeScreen` e é roteado por `navigation.tsx` a partir de
  `bootstrap.user.userType`. **Gap real**: as telas `Inspections`/`InspectionCapture` só estão
  registradas no branch `tenant_user` (`navigation.tsx:205-214`) — o operador loga, cai em
  `OperatorHome`, mas não tem caminho pra abrir uma vistoria atribuída a ele.
- `inspections.operator_id` já existe como FK. Não existe hoje nenhuma rota de API que filtre
  inspeções por `operator_id = <operador logado>`.

**Customer Portal**: padrão real é `requireMobileContext()` → rotas `/api/mobile/customer/*`
(não RLS direto — comentário em `rentals-portal.ts:1-12` explica que sessão Firebase não tem
`auth.uid()`, então leitura direta por RLS não funciona para o cliente). Único desvio existente:
`api/customer-contracts/[id]/accept/route.ts` usa `supabase.auth.getUser()` + checks manuais,
não `requireTenantScope()` nem `requireMobileContext()` — mas ainda assim os campos
`accepted_at`/`ip_address`/`user_agent` de `tenant_contract_acceptances` são 100% server-stamped
(confirmado lendo `packages/tenant-contract-engine/src/acceptance.ts:11-70`, que re-deriva
`contractVersionId`/`snapshotId` do banco, não confia no client). **Não existe hoje nenhuma rota
de inspeção acessível ao cliente** — todas as rotas em `api/inspections/**` usam
`requireTenantScope()` (staff-only).

**Schema do Inspection Engine**: `inspections.contract_id` já existe (FK nullable) e
`inspections.linked_inspection_id` já existe (liga check-out ao check-in). `inspection_findings`
já tem `overlay_region jsonb`. `inspection_media` **não** tem overlay nem campo de
ângulo/media_role — mas `inspection_media.item_id` já amarra a mídia ao
`inspection_template_items`, que é exatamente o campo que garante "mesmo ângulo" semântico
(item 14 do spec) sem precisar de coluna nova. `inspection_findings` **não** tem link
before/after (`finding_before_id` ou equivalente) — gap real, precisa de migration.
`inspection_signatures` já tem `signer_type ('customer'|'operator'|'tenant_staff')`,
`document_hash`, `ip_address`, `user_agent`, `acceptance_method` — é exatamente a forma pedida no
item 4 do spec para aceite de vistoria; será reaproveitada, não recriada.

**Storage/Sharing**: bucket `inspection-media` é privado (15 MiB, 6 mimes). Não existe hoje
nenhuma rota que gera signed URL para leitura de mídia de inspeção (só upload). **Não existe em
lugar nenhum do repo** um mecanismo de share token / verificação pública — grep por
`share_token|verify_token|/verify/` deu zero resultados em código. Precisa ser criado do zero
(vou seguir o padrão de `contract_documents`/signed URL já usado em
`customer-contracts/[id]/documents/[documentId]/url/route.ts`, mas para acesso público
tokenizado, que é um padrão novo).

**PDF**: nenhuma lib de PDF instalada (`@playwright/test` é devDependency de teste, não serve
para renderização em produção). Precisa adicionar `@react-pdf/renderer` (puro JS, roda em
função serverless Vercel sem browser headless — diferente de Puppeteer, que exigiria um
binário Chromium pesado incompatível com o runtime atual).

**Billing hook** (`apps/web/src/lib/inspection-billing.ts`): real, confirmado — só dispara com
`approved_cost_amount` setado por humano, idempotente via FK em `invoice_line_items`, no-op
silencioso se a inspeção não tiver `contract_id` (nunca cobra sem contrato).

## 2. Gaps confirmados (o que esta rodada precisa fechar)

| #   | Gap                                                                                                     | Tipo                                                                      |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Operator não tem tela de vistoria no mobile                                                             | UI + rota API filtrada por operator                                       |
| 2   | Cliente não acessa nenhuma inspeção                                                                     | rota API + UI customer portal                                             |
| 3   | Não existe aceite de vistoria pelo cliente (usa `inspection_signatures`, mas nunca chamado por cliente) | rota + reaproveita tabela existente                                       |
| 4   | Não existe contestação/divergência                                                                      | tabela nova pequena `inspection_disputes`                                 |
| 5   | Não existe PDF                                                                                          | lib nova + rota de geração                                                |
| 6   | Não existe share link seguro                                                                            | tabela nova `inspection_report_shares`                                    |
| 7   | Não existe verificação pública por QR                                                                   | coluna nova `inspection_reports.verification_token` + rota pública mínima |
| 8   | Não existe overlay UI (schema parcial: só em findings)                                                  | UI web+mobile, decisão de onde vive a coordenada                          |
| 9   | `InspectionComparisonViewer` não existe como componente reutilizável                                    | componente novo web                                                       |
| 10  | Preexisting vs new finding não distinguível                                                             | migration (`preexisting_finding_id` self-FK)                              |
| 11  | Offline mobile é falso hoje (envia tudo direto, sem fila/draft local)                                   | AsyncStorage queue + retry                                                |
| 12  | Testes de isolamento são scripts manuais, não suíte CI                                                  | vitest/HTTP tests permanentes                                             |
| 13  | Thumbnails/compressão de mídia                                                                          | resize client-side antes do upload (mobile)                               |

## 3. Decisões arquiteturais (documentadas, não pausando para aprovação — nenhuma é irreversível)

1. **Overlay vive por finding, não por foto solta.** Um finding já tem `item_id` (o item do
   checklist) e pode estar linkado a mídia via `inspection_media.finding_id`. Fluxo: usuário
   marca avaria sobre uma foto → cria (ou atualiza) um `Finding` com `overlay_region` (coords
   0..1) e a foto passa a referenciar esse finding via `finding_id`. Isso evita ambiguidade sem
   precisar adicionar coluna em `inspection_media` — a foto "dona" da marcação é a que tem
   `finding_id` apontando pro finding marcado. Documentado como desvio consciente do texto do
   spec ("overlay na fotografia") — na prática é overlay-por-finding-com-foto-associada, que é
   semanticamente equivalente e não deteriora o domínio.
2. **Divergência do cliente é uma entidade nova pequena, `inspection_disputes`, não um Finding
   forçado.** Um Finding representa uma avaria técnica avaliada por staff (severidade, custo,
   cobrança). Uma contestação de cliente é "não concordo com X", pode nem virar avaria real. Forçar
   em `Finding` quebraria o billing hook (que só dispara em `chargeable`) e a semântica de quem
   decide o quê. Tabela nova, ciclo próprio `OPEN → UNDER_REVIEW → ACCEPTED/REJECTED → RESOLVED`.
3. **Aceite de vistoria reaproveita `inspection_signatures` 100%** — já tem todos os campos do
   item 4 do spec. Só falta a rota customer-facing que grava com `signer_type='customer'`.
4. **Verificação pública (QR) e compartilhamento seguro são dois mecanismos distintos**, como o
   spec já separa nas seções 8 e 9: `inspection_reports.verification_token` (gerado uma vez por
   versão de laudo, embutido no QR, retorna só metadados mínimos — nunca mídia/dados pessoais) vs.
   `inspection_report_shares` (token com hash armazenado — nunca o token em claro —, TTL,
   revogação, audit trail, dá acesso ao PDF completo).
5. **PDF via `@react-pdf/renderer`**, gerado sob demanda numa rota de API (`GET
.../report/pdf`), nunca pré-renderizado/cacheado em disco — sempre a partir do snapshot
   imutável `inspection_reports.rendered_content` já existente.
6. **Offline mobile**: `expo-sqlite` ou `AsyncStorage` (AsyncStorage é suficiente pro volume —
   respostas de checklist + fila de upload, não precisa de SQL relacional) para draft local +
   fila de upload com idempotency key (`crypto.randomUUID()` gerado no device, enviado no
   header, rota de upload já idempotente por esse valor). Documentado como decisão, não um "true
   offline-first" com sync bidirecional complexo — é fila de escrita resiliente, que é o mínimo
   pedido pelo spec (seção 20).
7. **Migration nova, mínima**: `preexisting_finding_id uuid references inspection_findings(id)`
   em `inspection_findings` (nullable, self-FK) + `inspection_disputes` + `inspection_report_shares`
   - `inspection_reports.verification_token`. Uma migration de schema (`20260102000000_inspection_v1_completion.sql`).

Nenhuma dessas decisões é irreversível ou bloqueante — sigo direto para execução por fases,
reportando ao final de cada uma, como nas rodadas anteriores.

## 4. Ordem de execução (igual à seção 32 do spec)

P0.1 Operator Access → P0.2 Customer Self-Service → P0.3 Acceptance+Dispute → P0.4 PDF →
P0.5 Secure Sharing+Verification → P1.1 Overlay → P1.2 Before×After Viewer →
P1.3 Offline/Sync → P1.4 Security+HTTP suite → P1.5 Final E2E + relatório final.

IA de comparação visual **não entra nesta rodada** — `InspectionMediaComparisonProvider`
permanece só com `NullMediaComparisonProvider`, confirmado, nenhum provider real será conectado.
