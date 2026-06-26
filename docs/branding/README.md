# Shinã IA — Branding Assets

Repositório oficial dos ativos visuais da marca Shinã IA.

> **Tagline:** Operações Inteligentes em Movimento

---

## Identidade Visual

| Elemento        | Valor                                      |
| --------------- | ------------------------------------------ |
| Cor primária    | `#2563EB` — Electric Blue                  |
| Cor secundária  | `#06B6D4` — Cyan                           |
| Fundo principal | `#0A0F1E` — Deep Navy                      |
| Tipografia      | Inter (UI) · Manrope (Display)             |
| Forma símbolo   | "S" estilizado — fluxo de luz em movimento |

**Valores da marca:** Conectar · Inteligência · Movimento · Confiança · Escala · Automação

---

## Estrutura de Assets

```
docs/branding/assets/
├── shina-logo-concept-v1.png   ← Conceito aprovado (referência visual)
├── shina-logo-dark.png         ← Logo versão fundo escuro (uso principal)
├── shina-logo-light.png        ← Logo versão fundo claro
├── shina-icon.png              ← Ícone isolado (sem texto) — 512×512px
├── favicon.png                 ← Favicon — 32×32px
└── app-icon.png                ← Ícone de aplicativo — 1024×1024px
```

---

## Guia de Uso

### `shina-logo-concept-v1.png`

Conceito visual aprovado. Referência de identidade — símbolo "S" em luz + logotipo "SHINÃ IA".
**Não usar diretamente em produção.** Exportar variantes a partir deste concept.

### `shina-logo-dark.png`

Versão principal. Uso em fundos escuros (`#0A0F1E`, `#0F172A` ou similares).

- Recomendado para: sidebar, splash screen, e-mails corporativos.
- Dimensões mínimas: 120px de largura.

### `shina-logo-light.png`

Uso em fundos claros (`#FFFFFF`, `#F8FAFC` ou similares).

- Recomendado para: documentos impressos, apresentações com fundo branco.
- Dimensões mínimas: 120px de largura.

### `shina-icon.png`

Símbolo "S" isolado, sem texto. Para contextos onde o espaço é reduzido.

- Recomendado para: avatar de redes sociais, notificações, favicon alternativo.
- Exportar em 512×512px, fundo transparente.

### `favicon.png`

Ícone para navegadores web.

- Dimensão: **32×32px** (fornecer também versão 16×16px e ICO).
- Usar em `<link rel="icon">` no `<head>` de ambos os apps.

### `app-icon.png`

Ícone para app stores e atalhos de desktop.

- Dimensão: **1024×1024px**, fundo sólido `#0A0F1E`.
- Recomendado para: PWA manifest, futura versão mobile.

---

## Status dos Arquivos

| Arquivo                     | Status         | Observação                                          |
| --------------------------- | -------------- | --------------------------------------------------- |
| `shina-logo-concept-v1.png` | ⚠️ Placeholder | **Salvar a imagem do brand identity aprovado aqui** |
| `shina-logo-dark.png`       | ⚠️ Placeholder | Exportar a partir do concept v1                     |
| `shina-logo-light.png`      | ⚠️ Placeholder | Exportar a partir do concept v1                     |
| `shina-icon.png`            | ⚠️ Placeholder | Extrair o símbolo "S" isolado                       |
| `favicon.png`               | ⚠️ Placeholder | Redimensionar para 32×32px                          |
| `app-icon.png`              | ⚠️ Placeholder | Redimensionar para 1024×1024px                      |

> **Como substituir:** Salve cada arquivo PNG na pasta `docs/branding/assets/` com o nome exato listado acima, substituindo o placeholder.

---

## Uso nos Apps

### tenant-web e admin-web

Copiar os assets finais para:

```
apps/tenant-web/public/
apps/admin-web/public/
```

No `<head>` de cada app (`src/app/layout.tsx`):

```tsx
<link rel="icon" href="/favicon.png" sizes="32x32" />
<link rel="apple-touch-icon" href="/app-icon.png" />
```

---

## Referência Completa

Ver [`BRAND_IDENTITY_GUIDE.md`](./BRAND_IDENTITY_GUIDE.md) para paleta completa, tipografia, tons de voz e regras de uso da marca.
