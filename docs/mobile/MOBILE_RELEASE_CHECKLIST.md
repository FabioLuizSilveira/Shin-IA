# Mobile Release Checklist

Data: 2026-08-15 (Wave 4) · atualizado 2026-08-17 (gate M22) · **atualizado 2026-08-20 (iOS device
validation, sem dispositivo físico disponível)**. Baseado em auditoria real do código de
`apps/mobile` e `apps/web` — não é uma lista genérica de boas práticas, cada item reflete o estado
real confirmado nesta sessão.

**Nota 2026-08-20**: a maior parte deste documento é do gate M22 (agosto) e está desatualizada em
relação ao app atual — muitas telas/endpoints listados como `❌` abaixo já existem hoje (ver
`docs/mobile/MOBILE_PERFORMANCE_AUDIT_ANDROID.md`, que audita o app como ele é agora). Esta rodada
só corrigiu as linhas efetivamente reverificadas durante a validação iOS (bundle id, `eas.json`,
push, Apple Sign-In) — uma reauditoria completa do restante do documento está fora de escopo aqui.

**Legenda**: ✅ pronto · ⚠️ parcial/gap documentado · ❌ bloqueador real

**Atualização M22**: a partir do gate M22, o produto oficial é **um único app Shinã** com resolução
de persona server-driven — ver [ADR_UNIFIED_MOBILE_APP.md](../adr/ADR_UNIFIED_MOBILE_APP.md) e
[MOBILE_PERSONA_ARCHITECTURE.md](MOBILE_PERSONA_ARCHITECTURE.md). Os itens desta seção nova são
obrigatórios além de tudo já registrado abaixo; nenhum item antigo foi removido.

## Critérios obrigatórios — App Único (M22)

| Item                                                             | Status                             | Nota                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Um único binário oficial Shinã (não um app por persona)          | ✅                                 | `apps/mobile` é o binário único; nenhum código do Emergent branch foi mantido como app separado.                                                                                                                                                                                                                        |
| Resolução de persona via bootstrap (`GET /api/mobile/bootstrap`) | ✅                                 | `src/lib/bootstrap.ts` + `src/lib/persona-context.tsx` — chamada real, `userType` nunca inferido client-side.                                                                                                                                                                                                           |
| `tenant_user` reconhecido e roteado                              | ✅ (screen mínima)                 | `TenantHomeScreen` real, dados reais via `/api/mobile/dashboard`. Shell completo (5 módulos do Emergent) é M23.                                                                                                                                                                                                         |
| `customer` reconhecido e roteado                                 | ✅                                 | Reaproveita `RentalsListScreen`/`RentalDetailScreen` já existentes (decisão do ADR — não recriado).                                                                                                                                                                                                                     |
| `operator` reconhecido e roteado                                 | ✅ (screen mínima)                 | `OperatorHomeScreen` real, mesmo endpoint de dashboard (branch `operator`).                                                                                                                                                                                                                                             |
| `unprovisioned` reconhecido e roteado                            | ✅                                 | `UnprovisionedScreen` — estado + logout, nenhuma ação de provisionamento client-side.                                                                                                                                                                                                                                   |
| Sem fallback de mock em produção                                 | ✅ enforcement real                | `mock-policy.ts`'s `areMocksAllowed()` exige `__DEV__ && EXPO_PUBLIC_ENABLE_MOCKS === "1"` — `__DEV__` é `false` em todo build de release do Expo/Metro, não uma env var que possa ser setada por engano em produção.                                                                                                   |
| Sem dependência do backend Emergent (`backend/server.py`)        | ✅ nunca integrado                 | Confirmado morto e não mesclado (M21) — só o `frontend/` do branch foi portado.                                                                                                                                                                                                                                         |
| Sem dependência de domínio Emergent (`*.emergentagent.com`)      | ✅ nunca integrado                 | —                                                                                                                                                                                                                                                                                                                       |
| Sem auth de demo em produção                                     | ✅ enforcement real                | `enterDemoMode()` delega à mesma `areMocksAllowed()` — impossível em release build. Botão de demo no login também condicionado à mesma checagem.                                                                                                                                                                        |
| Bundle identifier oficial Shinã                                  | ⚠️ proposto, não registrado        | `br.com.shinaia.app` (iOS/Android) definido em `app.json` — **proposta de config**, não registrado em App Store Connect/Google Play Console (fora do escopo desta sessão, requer acesso externo). Confirmar que não colide com nada já registrado antes do primeiro build real.                                         |
| Deep-link scheme oficial Shinã                                   | ✅ preservado (decisão deliberada) | Mantido `shinacustomer` (não adotado o `shina` sugerido no M22) — já é uma dependência real em produção: `apps/web`'s `MOBILE_APP_SCHEME` usa esse exato scheme no fluxo de convite de cliente por e-mail. Trocar quebraria convites já enviados/agendados. Ver M22.15 ("se já existir, preservar, não criar colisão"). |

---

## Auth

| Item                                                             | Status                                    | Nota                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sessão persistida com segurança (não plaintext)                  | ✅                                        | `secure-session-store.ts` — padrão `LargeSecureStore` da própria Supabase: chave AES-256 por item no SecureStore (Keychain/Keystore), ciphertext no AsyncStorage. Corrigido nesta sessão (MÉD-11), antes era plaintext via polyfill de localStorage.                                                         |
| Token refresh automático                                         | ✅                                        | `autoRefreshToken: true` no client Supabase + `onAuthStateChange` atualiza o contexto.                                                                                                                                                                                                                       |
| Deep link de callback OAuth validado (não aceita URL arbitrária) | ✅                                        | `deep-link-session.ts` exige o path exato `auth/callback` (MÉD-12, corrigido).                                                                                                                                                                                                                               |
| Magic-link self-signup bloqueado                                 | ✅                                        | `shouldCreateUser: false` (Wave 0.1).                                                                                                                                                                                                                                                                        |
| Google OAuth                                                     | ✅                                        | `expo-auth-session` + `expo-web-browser`.                                                                                                                                                                                                                                                                    |
| **Apple Sign-In**                                                | ⚠️ código pronto, config externa pendente | `expo-apple-authentication` + `signInWithIdToken()` implementado (M22.3), botão nativo só em iOS. **MANUAL CONFIGURATION REQUIRED**: capability "Sign In with Apple" no Apple Developer identifier + provider Apple configurado no painel Supabase — nenhum dos dois pode ser verificado/feito nesta sessão. |
| **Logout / sign-out**                                            | ✅                                        | `useAuth().signOut()` (M22.13) — chama `supabase.auth.signOut()` (limpa a sessão segura) e reseta o estado local; `PersonaProvider` reseta o cache de bootstrap automaticamente quando a sessão vira null. Botão exposto em `TenantHomeScreen`/`OperatorHomeScreen`/`UnprovisionedScreen`.                   |
| MFA no app mobile                                                | ⚠️                                        | Não implementado — não confirmado como requisito de produto, documentado como gap.                                                                                                                                                                                                                           |
| Colisão de conta (mesmo e-mail, providers diferentes)            | ⚠️                                        | Comportamento real depende da configuração do painel Supabase (Authentication → Providers → linking de identidade) — **não verificado nesta wave**, precisa ser confirmado no painel antes do release, não assumido.                                                                                         |
| Dev backdoor (`EXPO_PUBLIC_DEV_ACCESS_TOKEN`)                    | ✅                                        | Gated por `__DEV__` (removido em build de release) + env var só-local. Confirmar que EAS build profiles de produção nunca definem essa var.                                                                                                                                                                  |

## API / Mobile BFF

| Item                                                     | Status | Nota                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Todos os endpoints implementados documentados no OpenAPI | ✅     | `docs/api/mobile-openapi.yaml`, `x-shina-status: implemented` + `x-shina-source` em cada um.                                                                                                                                                                                                 |
| `redocly lint` limpo                                     | ✅     | 0 erros, 3 warnings pré-existentes documentados (license ausente, 2 schemas ilustrativos não usados).                                                                                                                                                                                        |
| **Client mobile consumindo o BFF**                       | ❌     | **Só 3 telas existem no app** (`LoginScreen`, `RentalsListScreen`, `RentalDetailScreen`) contra ~25 endpoints reais construídos nas Waves 2-4 (operations, assets, tracking, billing, reports, notifications, documents). O backend está pronto; o app não consome a maior parte dele ainda. |

## Segurança

| Item                                                                             | Status | Nota                                                                                                                                                                                      |
| -------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nenhum secret de servidor no client                                              | ✅     | Auditado — `apps/mobile` só tem `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`.                                                                                               |
| Nenhuma URL hardcoded (localhost/HTTP) no client                                 | ✅     | Varredura completa em `apps/mobile/src` — zero ocorrências.                                                                                                                               |
| Logging não vaza token/PII                                                       | ✅     | Só 2 `console.*` em todo `apps/mobile/src`; nenhum loga JWT/refresh token/sessão/CPF.                                                                                                     |
| Logging não vaza detalhe interno de erro                                         | ⚠️     | `rentals.ts` loga o objeto de erro cru do Postgres/PostgREST (pode incluir nome de constraint/coluna) — visível via `adb logcat`/Xcode console num device físico. Gap menor, documentado. |
| Storage de sessão com integridade (MAC/AEAD)                                     | ⚠️     | AES-CTR sem autenticação — confidencialidade ok, mas sem proteção contra adulteração do blob armazenado. Hardening futuro, não bloqueador.                                                |
| Path traversal em upload de documento                                            | ✅     | Corrigido na Wave 3 Phase B (extensão derivada do MIME validado, não do filename).                                                                                                        |
| `operations:write` sem enforcement                                               | ✅     | Corrigido na Wave 2 Phase B.                                                                                                                                                              |
| Matriz de testes de segurança (cross-tenant/customer/operator, forged ids, IDOR) | ✅     | Verificado ao vivo contra o banco hospedado em cada fase desta e das waves anteriores — ver Security no relatório final da Wave 4.                                                        |

## Branding

| Item                                                          | Status | Nota                                                                                                   |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| Sem contexto de tenant → branding Shinã                       | ✅     | Bootstrap retorna `branding: {name: "Shinã"}` (`DEFAULT_BRANDING`) para `unprovisioned`.               |
| Com contexto de tenant → branding do tenant                   | ✅     | Bootstrap resolve `StudioRuntime.getPublished("branding", tenantId)`.                                  |
| Ícone do app permanece Shinã (não muda por tenant em runtime) | ✅     | Por construção — ícone nativo não pode mudar em runtime no Expo managed workflow; nenhum código tenta. |

## Permissões / Entitlements

| Item                                                    | Status | Nota                                                                                       |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Dados financeiros exigem permission, não só entitlement | ✅     | `tenant.dashboard.financial` checado em billing/reports/commissions (Wave 4 Phase A/B).    |
| Permissão nunca aceita do client                        | ✅     | Sempre resolvida via `hasTenantPermission()` server-side.                                  |
| Feature flags vêm do bootstrap, não hardcoded           | ✅     | `features`/`entitlements` no bootstrap; nenhum `if (plan === "pro")` encontrado no client. |

## Operações / Ativos / Contratos / Documentos / Tracking

| Item                                                 | Status | Nota                                                                                                                                          |
| ---------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoints reais, testados, com isolamento verificado | ✅     | Waves 2-3 — cross-tenant/cross-customer/cross-operator verificado ao vivo.                                                                    |
| Telas mobile correspondentes                         | ❌     | Nenhuma tela existe para operations/assets/contracts(detalhe+aceite)/documents/tracking — só rentals (que é uma view diferente, mais antiga). |

## Billing / Reports / Notifications

| Item                                               | Status                                            | Nota                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Endpoints reais, read-only, permission-gated       | ✅                                                | Wave 4 Phase A/B.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Push delivery real (Expo)                          | ✅                                                | Wave 4 Phase C — `MobilePushProvider`/`ExpoPushProvider`, pipeline completo.                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Client mobile registra push token**              | ✅ código / ⚠️ config não verificada (2026-08-20) | `expo-notifications` instalado, `push-registration.ts` implementado (`registerForPushNotifications()` → `POST /api/mobile/devices`), plugin listado em `app.json`. **Não verificado nesta rodada**: se as credenciais APNs (push key) estão de fato configuradas no projeto EAS — não checável sem `EXPO_TOKEN` válido nem dispositivo físico para testar o prompt de permissão/token real. Registrar como `PUSH IOS: MANUAL CONFIG REQUIRED / NOT TESTED` até confirmação em dispositivo. |
| Telas mobile (billing/reports/notification center) | ❌                                                | Não existem ainda.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## Deep Links

| Item                                                  | Status | Nota                                                                                                                                                                                    |
| ----------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Union fechado de tipos (nunca URL arbitrária)         | ✅     | `DeepLinkTarget` (Wave 4 Phase C).                                                                                                                                                      |
| App consegue navegar a partir de um deep link de push | ❌     | Sem tela de destino para a maioria dos tipos (operation/contract/document/tracking/invoice) e sem handler de deep link vindo de push (o handler existente só trata o callback de auth). |

## Offline

| Item                                   | Status            | Nota                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cache de dados sensíveis com expiração | ✅ (por ausência) | Confirmado: **nenhum cache local existe hoje** (`rentals.ts` sempre busca fresco via `useFocusEffect`) — não há política de expiração porque não há nada persistido para expirar. Válido enquanto permanecer assim; se cache for adicionado depois, precisa de política explícita. |
| Logout limpa cache privado             | ⚠️ N/A            | Não aplicável ainda — não há logout nem cache. Vira bloqueador real assim que qualquer um dos dois for implementado sem o outro.                                                                                                                                                   |

## Error UX / Loading / Empty / Retry

| Item                                           | Status | Nota                                                                                                                                                                         |
| ---------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading/empty/error/retry nas telas existentes | ⚠️     | Não auditado tela a tela nesta wave — as 3 telas existentes cobrem só o caminho de rentals; cobertura para as ~10 telas que ainda não existem é, por definição, inexistente. |
| Stack trace nunca exposto ao usuário           | ✅     | `rentals.ts`'s `toUserError()` sempre substitui o erro real por uma mensagem genérica antes de chegar à UI.                                                                  |

## Acessibilidade / Performance

| Item                                                          | Status | Nota                                                                                                                                   |
| ------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Contraste, labels, touch targets, font scaling, screen reader | ⚠️     | Não auditado nesta wave — app tem só 3 telas simples; recomendado antes do release real, não crítico agora dado o escopo mínimo de UI. |
| Bundle/startup/listas grandes/polling de tracking             | ⚠️     | Não auditado — sem tela de tracking ainda, "polling" não se aplica hoje; reavaliar quando a tela existir.                              |

## App Config (iOS/Android)

| Item                                               | Status                     | Nota                                                                                                                                                                                                   |
| -------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bundle identifier (iOS)                            | ✅ (atualizado 2026-08-20) | `br.com.shinaia.app`, registrado e confirmado ao vivo via App Store Connect API (`GET /v1/apps/6803529227`) — não é mais proposta, é o app real "Shinã", SKU `shina-customer-app`.                     |
| Package name (Android)                             | ✅                         | `br.com.shinaia.app` — mesmo identificador, já usado nos builds Android desta sessão (ver auditoria de performance Android).                                                                           |
| Build number (iOS) / version code (Android)        | ✅ (atualizado 2026-08-20) | iOS `buildNumber: "4"` em `app.json`, confirmado `VALID`/não-expirado no App Store Connect (build enviado 2026-08-20). Android `versionCode: 1`.                                                       |
| `eas.json` (build profiles dev/preview/production) | ✅ (atualizado 2026-08-20) | Existe com os 3 profiles (`development`/`preview`/`production`) + `submit.production.ios` configurado com ASC API key — usado ao vivo nesta sessão pros builds Android e pro submit iOS ao TestFlight. |
| Splash screen                                      | ❌                         | Sem `splash` configurado em `app.json`.                                                                                                                                                                |
| Deep-link scheme registrado                        | ✅                         | `"scheme": "shinacustomer"`.                                                                                                                                                                           |
| Associated domains (universal links iOS)           | ⚠️                         | Ausente — só relevante se universal links (https://) forem exigidos além do custom scheme; documentado como gap, não necessariamente bloqueador dependendo do requisito de produto.                    |
| Versão do app                                      | ✅                         | `"version": "1.0.0"` presente.                                                                                                                                                                         |

## Testes

| Item                                       | Status | Nota                                                                                                                                   |
| ------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Cobertura de teste no app mobile           | ❌     | **Zero arquivos de teste em `apps/mobile`.** `build`/`lint`/`typecheck` são todos apenas `tsc --noEmit` — não há suíte de testes real. |
| Cobertura de teste no backend mobile (BFF) | ✅     | 103 testes unitários + verificação ao vivo por fase em `apps/web`.                                                                     |

---

## Resumo — bloqueadores reais (❌) antes de qualquer submissão a loja

**Atualização M22**: itens 1 e 4 (logout, código de Apple Sign-In) foram resolvidos nesta milestone.

**Atualização 2026-08-20 (validação iOS)**: itens 2 (`eas.json`) e 7 (bundle id/package) abaixo estão
**resolvidos e confirmados** — `eas.json` existe e foi usado ao vivo, `br.com.shinaia.app` está
registrado de verdade no App Store Connect (build #4, `VALID`). Item 4 (push) tem o código pronto
(`expo-notifications` instalado), mas a configuração de credenciais APNs segue **não verificada**
por falta de dispositivo físico/token EAS válido nesta rodada. Itens 5 e 6 (cobertura de tela e
testes) não foram reauditados nesta rodada — o app cresceu muito desde o M22 (ver
`MOBILE_PERFORMANCE_AUDIT_ANDROID.md`), mas confirmar o estado atual exigiria uma varredura própria,
fora do escopo da validação iOS.

1. ~~Nenhum fluxo de logout no app~~ — **resolvido (M22.13)**.
2. ~~`eas.json` não existe~~ — **resolvido**, confirmado em uso real (Android builds + iOS TestFlight submit).
3. Apple Sign-In: código pronto, mas depende de capability no Apple Developer + provider configurado
   no painel Supabase — **MANUAL CONFIGURATION REQUIRED**, não algo que o código sozinho resolve.
   Não testável sem dispositivo físico iOS (nenhum aqui nesta rodada).
4. Push: código pronto (`expo-notifications` + `push-registration.ts`), mas credenciais APNs no EAS
   **não verificadas** — checar antes do release, testar prompt/token/notificação real em device.
5. Cobertura de tela mobile — desatualizado nesta linha, reauditar separadamente (não é escopo desta
   validação iOS).
6. Cobertura de teste automatizado no app mobile — não reauditado nesta rodada.
7. ~~Bundle identifier/package propostos~~ — **resolvido**, `br.com.shinaia.app` registrado e
   confirmado via App Store Connect API real.

Itens 3, 4, 5, 6 seguem não resolvidos — configuração externa (Apple Developer/Supabase/EAS push
key), acesso a dispositivo físico, ou trabalho fora do escopo desta rodada de validação iOS.
