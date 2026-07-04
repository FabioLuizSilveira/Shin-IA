# 04 — Color System

> Shinã Flow Design System™ · Wave 1 · AURORA

O sistema é **dark-first**: as escalas foram desenhadas para fundos escuros e
adaptadas para light mode, nunca o contrário. Âncoras da marca (doc 02) são
imutáveis; as escalas derivam delas.

---

## 1. Primárias

### Blue (plataforma) — âncora `#2563EB` (600)

| Tom     | Hex           | Uso                       |
| ------- | ------------- | ------------------------- |
| 50      | `#EFF6FF`     | Fundo sutil em light mode |
| 100     | `#DBEAFE`     | Hover claro               |
| 200     | `#BFDBFE`     | Bordas claras             |
| 300     | `#93C5FD`     | Texto sobre azul escuro   |
| 400     | `#60A5FA`     | Links em dark             |
| 500     | `#3B82F6`     | Hover do primário         |
| **600** | **`#2563EB`** | **Primário — Shinã Blue** |
| 700     | `#1D4ED8`     | Pressed                   |
| 800     | `#1E40AF`     | Fundos de destaque        |
| 900     | `#1E3A8A`     | Profundidade              |

### Purple (Marketing IA) — âncora `#6366F1` (500) / `#8B5CF6` (par)

| Tom     | Hex           | Uso                                              |
| ------- | ------------- | ------------------------------------------------ |
| 50      | `#EEF2FF`     | Fundo sutil light                                |
| 100     | `#E0E7FF`     | Hover claro                                      |
| 200     | `#C7D2FE`     | Bordas claras                                    |
| 300     | `#A5B4FC`     | Texto sobre roxo                                 |
| 400     | `#A78BFA`     | **MKT Glow** — acentos luminosos                 |
| **500** | **`#6366F1`** | **Primário MKT**                                 |
| 600     | `#7C3AED`     | Hover                                            |
| 700     | `#8B5CF6`\*   | Par do gradiente (\*posição de marca, não tonal) |
| 800     | `#5B21B6`     | Pressed                                          |
| 900     | `#4C1D95`     | Profundidade                                     |

### Cyan — âncora `#06B6D4` (500)

| Tom     | Hex           | Uso                               |
| ------- | ------------- | --------------------------------- |
| 50      | `#ECFEFF`     | —                                 |
| 100     | `#CFFAFE`     | —                                 |
| 200     | `#A5F3FC`     | —                                 |
| 300     | `#67E8F9`     | Dados em gráficos                 |
| 400     | `#22D3EE`     | Acentos                           |
| **500** | **`#06B6D4`** | **Shinã Cyan** — par do gradiente |
| 600     | `#0891B2`     | Hover                             |
| 700     | `#0E7490`     | —                                 |
| 800     | `#155E75`     | —                                 |
| 900     | `#164E63`     | —                                 |

## 2. Neutros (Gray/Slate)

Base de toda a interface. Derivada da família slate (subtom azulado, coerente
com a marca).

| Tom | Hex       | Uso em dark mode                                   |
| --- | --------- | -------------------------------------------------- |
| 50  | `#F8FAFC` | Texto máximo contraste (raro)                      |
| 100 | `#F1F5F9` | —                                                  |
| 200 | `#E2E8F0` | **Texto principal (Shinã Light)**                  |
| 300 | `#CBD5E1` | Texto forte                                        |
| 400 | `#94A3B8` | Texto secundário                                   |
| 500 | `#64748B` | **Shinã Slate** — texto terciário, ícones inativos |
| 600 | `#475569` | Desabilitado                                       |
| 700 | `#334155` | Bordas visíveis                                    |
| 800 | `#1E293B` | Superfícies elevadas                               |
| 900 | `#0F172A` | **Shinã Navy** — fundo padrão                      |
| 950 | `#020617` | **Shinã Black** — fundo profundo                   |

## 3. Semânticas

| Papel   | Base      | Fundo dark (10–15%)    | Texto em dark |
| ------- | --------- | ---------------------- | ------------- |
| Success | `#10B981` | `rgba(16,185,129,.12)` | `#34D399`     |
| Warning | `#F59E0B` | `rgba(245,158,11,.12)` | `#FBBF24`     |
| Danger  | `#EF4444` | `rgba(239,68,68,.12)`  | `#F87171`     |
| Info    | `#3B82F6` | `rgba(59,130,246,.12)` | `#60A5FA`     |

Regra: em dark mode, estados semânticos usam **fundo translúcido + borda
translúcida + texto no tom 400** — nunca blocos sólidos saturados.

## 4. Surface

| Token                | Valor                    | Uso                     |
| -------------------- | ------------------------ | ----------------------- |
| `surface.background` | `#0F172A`                | Fundo de app            |
| `surface.deep`       | `#020617`                | Fundo de marketing/hero |
| `surface.raised`     | `#1E293B`                | Cards sólidos           |
| `surface.glass`      | `rgba(255,255,255,0.04)` | Cards glass (padrão)    |
| `surface.glassHover` | `rgba(255,255,255,0.07)` | Hover de glass          |
| `surface.overlay`    | `rgba(2,6,23,0.60)`      | Scrim de modais         |

## 5. Bordas

| Token            | Valor                    | Uso               |
| ---------------- | ------------------------ | ----------------- |
| `border.subtle`  | `rgba(255,255,255,0.05)` | Divisores         |
| `border.default` | `rgba(255,255,255,0.08)` | Cards, inputs     |
| `border.strong`  | `rgba(255,255,255,0.16)` | Hover, foco suave |
| `border.focus`   | primária a 40%           | Anel de foco      |

## 6. Glow

| Token           | Valor                               |
| --------------- | ----------------------------------- |
| `glow.platform` | radial `#2563EB` 10% → transparente |
| `glow.mkt`      | radial `#6366F1` 10% → transparente |
| `glow.accent`   | radial `#A78BFA` 8% → transparente  |

Blur mínimo 64 px; sempre `pointer-events: none`; máx. 1 dominante/viewport.

## 7. Cores de gráficos

Sequência categórica (ordem fixa, acessível em dark):

1. `#60A5FA` (blue-400) · 2. `#A78BFA` (violet-400) · 3. `#22D3EE`
   (cyan-400) · 4. `#34D399` (emerald-400) · 5. `#FBBF24` (amber-400) ·
2. `#F87171` (red-400) · 7. `#94A3B8` (slate-400)

Séries além de 7: repetir a sequência com 60% de opacidade. Positivo/negativo:
sempre emerald/red-400.

## 8. Gradient tokens

| Token               | Definição                   | Uso                         |
| ------------------- | --------------------------- | --------------------------- |
| `gradient.platform` | `135deg, #2563EB → #06B6D4` | Marca plataforma, CTAs hero |
| `gradient.mkt`      | `135deg, #6366F1 → #8B5CF6` | Marca Marketing IA          |
| `gradient.mktText`  | `135deg, #6366F1 → #A78BFA` | Texto gradiente MKT         |
| `gradient.success`  | `135deg, #10B981 → #059669` | Confirmações hero (raro)    |

Gradientes nunca em texto de corpo, tabelas ou componentes de formulário.

## 9. Light mode

Light mode inverte superfícies e neutros (bg `#FFFFFF`/`#F8FAFC`, texto
`#0F172A`), mantém primárias e semânticas nos tons 600–700 para contraste e
**elimina glow e glass** (substituídos por sombras da escala do doc 06).

## 10. Regras de acessibilidade

- Texto corpo sobre fundo: contraste ≥ 4.5:1. Display ≥ 3:1.
- Cor nunca é o único canal de informação (sempre ícone ou rótulo junto).
- Testar toda paleta nova contra os fundos `#0F172A` e `#FFFFFF`.
