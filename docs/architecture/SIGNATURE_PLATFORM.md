# Shinã Signature Platform

Infraestrutura de assinatura eletrônica provider-agnostic da Shinã. Nenhuma
parte do Contract Engine, da UI, do Workflow ou de qualquer domínio Shinã
depende de nomenclatura, status, IDs, tokens, URLs, eventos ou payloads
específicos de um provider (Clicksign hoje; qualquer outro amanhã) — tudo
cruza a fronteira por um domínio canônico único, definido em
`packages/signature-platform/src/types.ts`.

**Status: P0 (fundação) e P1 (adapter real da Clicksign, sandbox) estão
implementados.** P2 (UI, Customer Portal, Mobile, notificações,
observability) ainda não começou. Cutover de produção **não está
autorizado** — nem por config, nem por código: o adapter da Clicksign não
tem sequer um branch de produção implementado (ver `CLICKSIGN.md`).

## Por que provider-agnostic

Modelado diretamente no padrão já provado de `packages/billing-platform`
(`BillingProvider` + `createBillingProvider()` selecionando por env var,
depois de uma migração real de Stripe para Asaas nesta mesma base de
código) — a mesma disciplina se aplica aqui porque um provider de
assinatura eletrônica carrega consequências jurídicas reais (validade legal
de um documento assinado), então trocar de provider não pode significar
reescrever o Contract Engine, a UI ou qualquer lógica de negócio.

## As peças

```
packages/signature-platform/src/
  types.ts                          # domínio canônico + interface SignatureProvider
  create-provider.ts                # resolver por SIGNATURE_PROVIDER
  signature-service.ts              # createSignatureRequest() / applySignatureEvent()
  providers/
    fake.ts                         # FakeSignatureProvider — testes, sem rede
    clicksign.ts                    # ClicksignProvider — real, sandbox only
    clicksign-status-mapper.ts      # ÚNICO lugar que conhece o vocabulário da Clicksign
```

### Domínio canônico

- `SignatureStatus`: `draft | sent | in_progress | signed | cancelled |
expired | failed`.
- `SignerRole`: `customer | operator | guarantor | witness |
tenant_representative | other`.
- `SignatureEventKind`: os eventos que o Workflow (quando existir, P2)
  consumiria — `signature_request_sent`, `signer_viewed`, `signer_signed`,
  `signer_refused`, `signature_completed`, `signature_cancelled`,
  `signature_expired`, `signature_failed`.
- `SignatureArtifactKind`: `original | signed | evidence | certificate`
  (P1 só produz `signed` de verdade — ver gaps abaixo).

### `SignatureProvider` — a fronteira

Interface com 6 métodos (`createRequest`, `getRequest`,
`getSigningSession`, `cancelRequest`, `getSignedArtifacts`,
`normalizeWebhook`). Qualquer adapter concreto (Fake hoje, Clicksign desde
o P1) é o ÚNICO lugar autorizado a conhecer o vocabulário do gateway por
trás dele.

`normalizeWebhook(rawBody: string, headers)` recebe o corpo **bruto**
(nunca já parseado) — decisão do P1: a Clicksign autentica webhooks via
HMAC sobre os bytes exatos, algo impossível de verificar depois de um
`JSON.parse()`. O provider verifica a autenticidade e só então faz o
parse — nunca o inverso.

### Núcleo de escrita — `signature-service.ts`

- `createSignatureRequest(db, provider, input)` — revalida
  `contractVersionId`/`snapshotId` contra a tabela `contracts` antes de
  qualquer chamada ao provider (mesma disciplina de
  `recordContractAcceptance()` do `@shina/tenant-contract-engine`).
- `applySignatureEvent(db, provider, event)` — idempotente (log-first em
  `signature_webhook_events`, índice único composto
  `(provider, provider_event_id)`). Em `signature_completed`: baixa os
  artefatos assinados, sobe pro bucket `contract-documents` (prefixo
  `signatures/`, nunca a tabela `contract_documents` — que é de outra
  coisa, uploads de KYC), e chama `recordContractAcceptance()` uma vez por
  signatário `customer`/`operator`, com o hash do artefato final assinado.

## Fluxo ponta a ponta (P1)

```
1. POST /api/signature-requests { contractId, signers[] }
2. apps/web renderiza o snapshot congelado (tenant_contract_snapshots)
   como PDF (contract-signature-pdf.tsx)
3. createSignatureRequest() valida + grava signature_requests/signers (draft)
4. ClicksignProvider.createRequest(): cria envelope, sobe documento,
   cria signatários, cria requirements (assinatura + autenticação por email),
   ativa o envelope (draft -> running)
5. signature_requests passa a "sent"
6. Clicksign envia e-mails de assinatura diretamente aos signatários
   (comunicação própria do provider — Shinã não manda um segundo e-mail
   com o link, ver CLICKSIGN.md)
7. Signatário assina -> Clicksign dispara webhook -> POST /api/webhooks/clicksign
8. normalizeWebhook() verifica HMAC, mapeia pro evento canônico
   signature_completed
9. applySignatureEvent(): baixa o artefato assinado, calcula hash SHA-256
   por conta própria (nunca confia num hash que a Clicksign possa reportar),
   grava signature_artifacts, chama recordContractAcceptance() por
   signatário elegível
```

## Gaps documentados (não escondidos)

- Nenhuma UI existe ainda — tudo isso só é alcançável via API hoje.
- `getSigningSession()` e o artefato de `evidence`/`certificate` não foram
  exercitados contra a sandbox real — campos exatos ainda não confirmados
  (ver `CLICKSIGN.md`).
- `guarantor`/`witness`/`tenant_representative`/`other` são signatários
  reais e rastreáveis, mas não geram `recordContractAcceptance()` — só
  `customer`/`operator` têm essa ponte hoje.
- Nenhuma rota aplica as permissões `tenant.contracts.signature.*`
  semeadas pelo P0 — gap pré-existente em toda a plataforma (nenhuma rota
  do repo aplica `tenant_permissions` em tempo de request hoje), não algo
  que este módulo resolveu sozinho.
- `contracts.status` não muda automaticamente quando uma assinatura
  completa — decisão de política do Contract Workflow ainda não tomada
  pelo usuário, não decidida unilateralmente aqui.
