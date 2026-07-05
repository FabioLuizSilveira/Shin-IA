# 05 — Typography

> Shinã Flow Design System™ · Wave 1 · AURORA

---

## 1. Fontes oficiais

| Papel                   | Fonte              | Fallback                     |
| ----------------------- | ------------------ | ---------------------------- |
| Display / Headings      | **Manrope**        | Inter, system-ui, sans-serif |
| Corpo / UI              | **Inter**          | system-ui, sans-serif        |
| Código / dados técnicos | **JetBrains Mono** | ui-monospace, monospace      |

Carregamento via Google Fonts com `display=swap`. Pesos usados: Inter
400/500/600/700/800/900; Manrope 600/700/800.

## 2. Escala tipográfica

Base 16 px, razão ~1.25 ajustada opticamente. Valores em px / line-height /
peso / tracking.

| Estilo      | Tamanho | Leading | Peso | Tracking | Fonte          | Uso                   |
| ----------- | ------- | ------- | ---- | -------- | -------------- | --------------------- |
| Display XXL | 72      | 1.05    | 900  | −2%      | Manrope        | Hero de marketing     |
| Display XL  | 60      | 1.05    | 900  | −2%      | Manrope        | Hero secundário       |
| Display     | 48      | 1.10    | 800  | −1.5%    | Manrope        | Títulos de landing    |
| H1          | 36      | 1.15    | 800  | −1%      | Manrope        | Título de página      |
| H2          | 30      | 1.20    | 700  | −1%      | Manrope        | Seção principal       |
| H3          | 24      | 1.25    | 700  | −0.5%    | Manrope        | Subseção              |
| H4          | 20      | 1.30    | 600  | −0.5%    | Manrope        | Card title            |
| H5          | 16      | 1.40    | 600  | 0        | Inter          | Título compacto       |
| Body Large  | 18      | 1.60    | 400  | 0        | Inter          | Texto editorial       |
| Body        | 14      | 1.55    | 400  | 0        | Inter          | **Padrão de UI**      |
| Small       | 12      | 1.45    | 400  | 0        | Inter          | Suporte, metadados    |
| Caption     | 11      | 1.40    | 500  | +1%      | Inter          | Legendas, timestamps  |
| Label       | 12      | 1.20    | 500  | +1%      | Inter          | Rótulos de campo      |
| Button      | 14      | 1.00    | 600  | 0        | Inter          | Ações                 |
| Overline    | 11      | 1.20    | 700  | +8% caps | Inter          | Eyebrows de seção     |
| Code        | 13      | 1.50    | 400  | 0        | JetBrains Mono | Payloads, IDs, tokens |

## 3. Cores tipográficas (dark mode)

| Papel                   | Token                   | Hex       |
| ----------------------- | ----------------------- | --------- |
| Principal               | gray-200                | `#E2E8F0` |
| Títulos                 | white                   | `#FFFFFF` |
| Secundário              | gray-400                | `#94A3B8` |
| Terciário / placeholder | gray-500                | `#64748B` |
| Desabilitado            | gray-600                | `#475569` |
| Link / acento           | primária-400 do produto | —         |

## 4. Regras de uso

- **Máximo 3 níveis** de heading por tela (doc 03, P4).
- Números tabulares (`font-variant-numeric: tabular-nums`) em tabelas,
  KPIs e valores monetários.
- Texto de corpo nunca abaixo de 12 px; nada clicável com fonte < 12 px.
- Largura de leitura: parágrafos entre 45–75 caracteres (`max-width: 65ch`).
- Truncar com ellipsis apenas metadados; nunca truncar valores acionáveis
  sem tooltip.
- Gradiente em texto: apenas Display/H1 de marketing, uma ocorrência por
  seção (doc 04 §8).
- ALL CAPS somente no estilo Overline.

## 5. Responsividade

| Estilo      | Desktop ≥1024 | Tablet ≥640 | Mobile <640 |
| ----------- | ------------- | ----------- | ----------- |
| Display XXL | 72            | 56          | 40          |
| Display XL  | 60            | 48          | 36          |
| Display     | 48            | 40          | 32          |
| H1          | 36            | 30          | 26          |
| H2          | 30            | 26          | 22          |
| H3          | 24            | 22          | 20          |
| Demais      | inalterados   | inalterados | inalterados |

A escala de corpo (Body/Small/Caption) **não** muda por breakpoint — muda o
layout, não a letra.

## 6. Anti-padrões

- Misturar Manrope no corpo ou Inter em display hero.
- Peso 300 em qualquer lugar (contraste insuficiente em dark).
- Itálico para ênfase em UI (usar peso ou cor).
- Sombras de texto.
