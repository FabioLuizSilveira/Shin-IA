# Mobile Release Checklist

Data: 2026-08-15 · Produzido ao final da Wave 4 (Business Mobile + Release Readiness). Baseado em
auditoria real do código de `apps/mobile` e `apps/web` — não é uma lista genérica de boas práticas,
cada item reflete o estado real confirmado nesta sessão.

**Legenda**: ✅ pronto · ⚠️ parcial/gap documentado · ❌ bloqueador real

---

## Auth

| Item                                                             | Status | Nota                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessão persistida com segurança (não plaintext)                  | ✅     | `secure-session-store.ts` — padrão `LargeSecureStore` da própria Supabase: chave AES-256 por item no SecureStore (Keychain/Keystore), ciphertext no AsyncStorage. Corrigido nesta sessão (MÉD-11), antes era plaintext via polyfill de localStorage. |
| Token refresh automático                                         | ✅     | `autoRefreshToken: true` no client Supabase + `onAuthStateChange` atualiza o contexto.                                                                                                                                                               |
| Deep link de callback OAuth validado (não aceita URL arbitrária) | ✅     | `deep-link-session.ts` exige o path exato `auth/callback` (MÉD-12, corrigido).                                                                                                                                                                       |
| Magic-link self-signup bloqueado                                 | ✅     | `shouldCreateUser: false` (Wave 0.1).                                                                                                                                                                                                                |
| Google OAuth                                                     | ✅     | `expo-auth-session` + `expo-web-browser`.                                                                                                                                                                                                            |
| **Apple Sign-In**                                                | ❌     | **Ausente.** App tem Google OAuth mas não Sign in with Apple — risco real de rejeição na App Store (guideline 4.8) se o app for publicado assim.                                                                                                     |
| **Logout / sign-out**                                            | ❌     | **Não existe nenhum fluxo de logout no app** — `signOut()` nunca é chamado em lugar nenhum do código. Nenhuma tela tem botão de sair. Bloqueador de QA básico, não só de "boa prática".                                                              |
| MFA no app mobile                                                | ⚠️     | Não implementado — não confirmado como requisito de produto, documentado como gap.                                                                                                                                                                   |
| Colisão de conta (mesmo e-mail, providers diferentes)            | ⚠️     | Comportamento real depende da configuração do painel Supabase (Authentication → Providers → linking de identidade) — **não verificado nesta wave**, precisa ser confirmado no painel antes do release, não assumido.                                 |
| Dev backdoor (`EXPO_PUBLIC_DEV_ACCESS_TOKEN`)                    | ✅     | Gated por `__DEV__` (removido em build de release) + env var só-local. Confirmar que EAS build profiles de produção nunca definem essa var.                                                                                                          |

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

| Item                                               | Status | Nota                                                                                                                                                                                         |
| -------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoints reais, read-only, permission-gated       | ✅     | Wave 4 Phase A/B.                                                                                                                                                                            |
| Push delivery real (Expo)                          | ✅     | Wave 4 Phase C — `MobilePushProvider`/`ExpoPushProvider`, pipeline completo.                                                                                                                 |
| **Client mobile registra push token**              | ❌     | **`expo-notifications` não está instalado no app** — o servidor sabe enviar push, o app não tem nenhum código para pedir permissão, obter token, ou registrar em `POST /api/mobile/devices`. |
| Telas mobile (billing/reports/notification center) | ❌     | Não existem ainda.                                                                                                                                                                           |

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

| Item                                               | Status | Nota                                                                                                                                                                                            |
| -------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bundle identifier (iOS)                            | ❌     | **Ausente em `app.json`** — bloqueia `eas build`/App Store submission. Requer decisão de produto (ex. `br.com.shinaia.customer`), não uma escolha técnica que deva ser inventada sem aprovação. |
| Package name (Android)                             | ❌     | **Ausente.** Mesma observação.                                                                                                                                                                  |
| Build number (iOS) / version code (Android)        | ❌     | **Ausentes.**                                                                                                                                                                                   |
| `eas.json` (build profiles dev/preview/production) | ❌     | **Não existe.** Nenhuma configuração de build nesta wave — precisa ser criado antes de qualquer build real.                                                                                     |
| Splash screen                                      | ❌     | Sem `splash` configurado em `app.json`.                                                                                                                                                         |
| Deep-link scheme registrado                        | ✅     | `"scheme": "shinacustomer"`.                                                                                                                                                                    |
| Associated domains (universal links iOS)           | ⚠️     | Ausente — só relevante se universal links (https://) forem exigidos além do custom scheme; documentado como gap, não necessariamente bloqueador dependendo do requisito de produto.             |
| Versão do app                                      | ✅     | `"version": "1.0.0"` presente.                                                                                                                                                                  |

## Testes

| Item                                       | Status | Nota                                                                                                                                   |
| ------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Cobertura de teste no app mobile           | ❌     | **Zero arquivos de teste em `apps/mobile`.** `build`/`lint`/`typecheck` são todos apenas `tsc --noEmit` — não há suíte de testes real. |
| Cobertura de teste no backend mobile (BFF) | ✅     | 103 testes unitários + verificação ao vivo por fase em `apps/web`.                                                                     |

---

## Resumo — bloqueadores reais (❌) antes de qualquer submissão a loja

1. Nenhum fluxo de logout no app.
2. `ios.bundleIdentifier`/`android.package`/build numbers ausentes — build de release não é possível como está.
3. `eas.json` não existe.
4. Sem Apple Sign-In (risco de rejeição se publicado com Google OAuth apenas).
5. `expo-notifications` não instalado — push do backend não chega a lugar nenhum no client ainda.
6. Cobertura de tela mobile muito atrás do backend — 3 telas contra ~25 endpoints reais.
7. Zero testes automatizados no app mobile.

Nenhum destes é resolvido nesta wave — são decisões de produto/trabalho de UI real, fora do escopo de
um hardening de backend. Documentados aqui para que a aprovação humana decida a próxima iniciativa.
