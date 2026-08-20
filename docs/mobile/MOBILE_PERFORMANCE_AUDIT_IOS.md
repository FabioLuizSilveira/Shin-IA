# Shinã Mobile — iOS Device Validation

**Data:** 2026-08-20
**Ambiente:** nenhum iPhone físico disponível nesta sessão (sem ferramenta equivalente ao `adb` para
automação de dispositivo iOS). Por decisão explícita do usuário, esta rodada cobre apenas o que é
verificável sem dispositivo — build validation, configuração real via App Store Connect API,
lint/typecheck/expo-doctor, e revisão de código dos fluxos iOS-específicos (Apple Sign-In, deep
links, push). Nenhuma métrica de tempo/FPS/memória foi medida ou estimada. Ver
`docs/mobile/MOBILE_PERFORMANCE_AUDIT_ANDROID.md` para a baseline Android real (Pass 1 + Pass 2).

---

## 1 — Ambiente testado

| Campo              | Valor                                                                              |
| ------------------ | ---------------------------------------------------------------------------------- |
| Dispositivo físico | **Nenhum disponível nesta rodada**                                                 |
| Simulador          | Não usado (não substitui dispositivo real per instrução do spec)                   |
| Build Shinã        | `versionName 1.0.0`, `buildNumber 4`                                               |
| Bundle identifier  | `br.com.shinaia.app`                                                               |
| Ambiente API       | `https://app.shinaia.com.br` (`EXPO_PUBLIC_SHINAIA_API_URL`, profile `production`) |
| Supabase project   | `wokoqmoulsvzikkdcmfc`                                                             |

## 2 — Build validation (confirmado via App Store Connect API real)

Consulta real via JWT ES256 assinado com a chave ASC (`GET /v1/apps/6803529227`,
`GET /v1/builds?filter[app]=6803529227`), não estimativa:

```
APP: name="Shinã", bundleId="br.com.shinaia.app", sku="shina-customer-app", primaryLocale="pt-BR"
BUILD: version 4, processingState VALID, uploadedDate 2026-08-20T08:44:08-07:00, expired=false
```

- `bundleIdentifier` (`app.json`) = `br.com.shinaia.app` — **confere** com o registro real.
- `buildNumber` (`app.json`) = `"4"` — **confere** com o build `VALID` mais recente no ASC.
- `usesAppleSignIn: true` + plugin `expo-apple-authentication` presentes em `app.json`.
- Mocks estruturalmente impossíveis: `mock-policy.ts`'s `areMocksAllowed()` exige `__DEV__ &&
EXPO_PUBLIC_ENABLE_MOCKS === "1"` — `__DEV__` é `false` em qualquer build `eas build` de
  `preview`/`production`, não há env var capaz de religar isso numa build de release.
- Nenhum secret privilegiado no client: `apps/mobile` só referencia
  `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (chave anon, pública por design)
  — nenhuma `SUPABASE_SERVICE_ROLE_KEY` ou equivalente em `eas.json`/`app.json`/código do app.
- Nenhum rebuild foi disparado nesta rodada (nenhuma alteração de código exigiu isso).

## 3 — Auth smoke test

**Não executado** — requer dispositivo físico/simulador interativo, indisponível nesta rodada.
Revisão de código (não substitui o teste real):

- **Apple Sign-In**: `LoginScreen.tsx`'s `handleAppleLogin()` usa
  `AppleAuthentication.signInAsync()` → `supabase.auth.signInWithIdToken({provider: "apple"})`,
  botão nativo (`AppleAuthenticationButton`) renderizado só quando `Platform.OS === "ios"`. Código
  correto, mas depende de duas configurações externas que este ambiente não consegue verificar: (1)
  capability "Sign In with Apple" habilitada no identifier do Apple Developer, (2) provider Apple
  configurado no painel do Supabase (Authentication → Providers). **MANUAL CONFIGURATION REQUIRED**
  — sem confirmação de que ambas estão feitas.
- **Google Sign-In**: `handleGoogleLogin()` usa `supabase.auth.signInWithOAuth({provider: "google"})`
  - `expo-web-browser`'s `openAuthSessionAsync()`, com `redirectTo` via `makeRedirectUri({scheme:
"shinacustomer", path: "auth/callback"})` — mesmo padrão PKCE/deep-link do Android, sem código
    iOS-específico visível que pudesse quebrar. Não testado ao vivo.
- **Deep link de callback OAuth**: `deep-link-session.ts`'s `isAllowedCallbackUrl()` valida o path
  exato `auth/callback` antes de aceitar tokens — proteção contra URL arbitrária, independente de
  plataforma. Sem teste ao vivo do handshake real no iOS.
- **Session persistence**: `secure-session-store.ts` usa o padrão `LargeSecureStore` (Keychain no
  iOS via `expo-secure-store`, Keystore no Android) — mesmo código cross-platform, sem branch
  iOS-específico a auditar separadamente.

**Resultado**: `AUTH: PENDING` para os três fluxos (Apple/Google/Session) — não fabricado PASS/FAIL
sem execução real.

## 4–13 — Performance, memória, background/resume, network

**Todos PENDING** — todas essas seções do spec original exigem execução em dispositivo físico
(cold starts cronometrados, navegação real, WebView real, background/resume real, degradação de
rede real). Nenhum número foi medido, estimado, ou copiado da baseline Android. A instrumentação
`perf-trace.ts`/`_perf` criada para o Android (`EXPO_PUBLIC_PERF_TRACE=1` + header `x-perf-trace`)
é **cross-platform por construção** (JS puro, sem código nativo específico de Android) — reutilizável
sem alteração assim que houver um dispositivo iOS real para rodar a mesma bateria de 10 cold starts.

## 14 — Push notifications

Código presente (`expo-notifications` instalado, `push-registration.ts` implementado,
`registerForPushNotifications()` pede permissão → obtém `ExpoPushToken` → registra em
`POST /api/mobile/devices`), plugin listado em `app.json`. **Não verificável nesta rodada** se as
credenciais APNs (push key) estão de fato configuradas no projeto EAS — checagem requer
`EXPO_TOKEN` válido (o usado nesta sessão expirou) ou acesso ao painel do Expo, nenhum dos dois
disponível agora.

**Resultado**: `PUSH IOS: MANUAL CONFIG REQUIRED / NOT TESTED`.

## 15 — Deep links

Único deep link implementado no app inteiro (Android e iOS) é o callback de OAuth
(`shinacustomer://auth/callback`), tratado por `App.tsx`'s `DeepLinkHandler` +
`deep-link-session.ts`. Os tipos citados no spec (contract/operation/notification/tracking/invoice)
**não estão implementados** — confirmado também na auditoria Android anterior e no
`MOBILE_RELEASE_CHECKLIST.md` ("Deep Links" → "App consegue navegar a partir de um deep link de
push" = ❌). Nada a testar além do callback de auth, que por sua vez depende do smoke test da
Seção 3 (não executado).

## 16–19 — Critical journeys, crash check, correções, comparação Android × iOS

Não executáveis sem dispositivo. Nenhuma correção de código foi necessária nesta rodada (nada
encontrado que dependesse de execução real para ser corrigido — os achados desta rodada foram todos
de configuração/verificação, não de bug).

### Tabela comparativa

| Metric                       | Android (Pass 2, real) | iOS | Status  |
| ---------------------------- | ---------------------: | --: | ------- |
| Time to Useful Dashboard p50 |                 1992ms |   — | PENDING |
| Time to Useful Dashboard p95 |                 2759ms |   — | PENDING |
| Session Restore p50          |                   11ms |   — | PENDING |
| Bootstrap p50                |                  993ms |   — | PENDING |
| Dashboard API p50            |                  879ms |   — | PENDING |
| Tracking usable              |                    ~2s |   — | PENDING |
| Navigation                   |                   GOOD |   — | PENDING |
| Memory stability             |                   GOOD |   — | PENDING |

Nenhuma regressão pode ser identificada sem dados — a tabela fica em branco por honestidade, não
por omissão.

---

## RESULTADO FINAL

```
IOS DEVICE:
nenhum disponível nesta rodada

AUTH:
APPLE: PENDING (código correto; config externa não verificável; sem device p/ testar)
GOOGLE: PENDING (sem device p/ testar)
SESSION: PENDING (sem device p/ testar)

TIME TO USEFUL DASHBOARD:
p50: PENDING
p95: PENDING

BOOTSTRAP:
p50: PENDING
p95: PENDING

BOOTSTRAP REQUESTS PER COLD START:
PENDING (fix de dedupe já no código, ver auditoria Android — não re-testado em iOS)

DASHBOARD API:
p50: PENDING
p95: PENDING

TRACKING:
PENDING

NAVIGATION:
PENDING

MEMORY:
PENDING

BACKGROUND/RESUME:
PENDING

PUSH:
MANUAL CONFIG REQUIRED / NOT TESTED

DEEP LINKS:
PENDING (só o callback OAuth existe; não testado ao vivo)

CRASHES:
PENDING (nenhum observado, mas também nenhuma execução real ocorreu)

P0:
nenhum encontrado (build/config/código revisados, sem execução real)

P1:
nenhum encontrado nesta rodada

ANDROID PERFORMANCE:
GOOD (confirmado, Pass 2)

IOS PERFORMANCE:
BLOCKED — sem dispositivo físico disponível, nenhuma métrica pode ser reportada sem fabricação

CROSS-PLATFORM PERFORMANCE:
PENDING

PHYSICAL DEVICE TEST:
PENDING

READY FOR TESTFLIGHT:
YES — o build #4 já está `VALID` no App Store Connect e distribuído (decisão de rodadas
anteriores desta sessão); esta rodada não encontrou nada no código/config que bloqueie isso.

READY FOR STORE RELEASE:
NO
```

**O que impede fechar esta validação**: acesso a um iPhone físico (ou alguém que opere um,
seguindo um roteiro guiado como foi feito para o setup inicial da Apple Developer). Sem isso, os
itens `PENDING` acima só podem ser fechados com números reais quando o dispositivo existir —
nunca com uma estimativa baseada na baseline Android.
