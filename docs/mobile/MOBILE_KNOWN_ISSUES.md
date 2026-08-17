# Mobile — Known Issues

Data: 2026-08-17 (M23–27 sprint). Gaps reais que afetam produto, não itens cerimoniais.

## Módulos parcialmente conectados

- **Tracking**: sem endpoint bulk (M21 gap). `OperationDetailScreen` (não construído nesta
  sprint) usaria `trackingSummary` já retornado por `GET /api/mobile/operations/{id}` — zero
  requests extras. Uma tela dedicada de mapa com múltiplos recursos continua fora de escopo (exigiria
  N requests ou um endpoint novo, nenhum dos dois aceito pela regra "sem N requests absurdos").
- **Documents**: sem inbox cross-contrato (M21 gap #2). Acesso a documentos é sempre contextual a um
  contrato (`shinaia.contractDocuments`), já implementado no client mas sem tela dedicada ainda.
- **Asset maintenance history** (M21 gap #3): nenhum endpoint real existe. Não foi inventado —
  diferente do frontend Emergent original, que tinha um array hardcoded fake nessa tela.
- **Operation status mutation**: `shinaia.updateOperationStatus()` existe e está correto
  (`PATCH /api/operations/{id}`, re-validado 100% server-side), mas nenhuma tela ainda chama —
  `OperationDetailScreen` fica para a próxima sessão.
- **Document upload/review mutations**: `shinaia.reviewDocument()`/upload existem no client,
  sem tela.

## Auth

- **Apple Sign-In**: código completo (`expo-apple-authentication` + `signInWithIdToken`), mas
  requer capability no Apple Developer identifier + provider Apple configurado no Supabase —
  **MANUAL CONFIGURATION REQUIRED**, não verificável nesta sessão.
- **Colisão de conta** (mesmo e-mail, Google vs. Apple vs. magic link): comportamento real depende
  do painel Supabase (Authentication → Providers → linking de identidade), não verificado.

## Push

- Registro de device (`POST /api/mobile/devices`) está com código real, mas só funciona com um
  `projectId` de EAS configurado (`eas init`) — **`eas.json` não existe neste repo**. Sem isso,
  `registerForPushNotifications()` retorna `null` de forma segura (não quebra o app, só não
  registra).

## App Identity

- Bundle id/package (`br.com.shinaia.app`) são **propostos**, não registrados em App Store
  Connect/Google Play Console — precisa de confirmação humana de que não colidem com nada já
  existente antes do primeiro build de release real.
- `eas.json` não existe — nenhum build de release é possível como está.

## Cobertura

- Persona `operator`: só uma tela mínima (`OperatorHomeScreen`), sem o shell completo.
- Persona `customer`: reaproveita as telas antigas (`RentalsListScreen`/`RentalDetailScreen`), que
  falam direto com PostgREST via RLS — não migradas para o client `shinaia-api.ts` desta sprint
  (decisão deliberada, ADR — não recriar o que já funciona).
- Zero testes automatizados no app mobile (gap pré-existente, não fechado nesta sprint).

## Não é gap — confirmado intencional

- Mock/demo mode: só existe atrás de `__DEV__ && EXPO_PUBLIC_ENABLE_MOCKS=1`, nunca em
  staging/produção.
