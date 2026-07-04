# 06 — Spacing & Grid

> Shinã Flow Design System™ · Wave 1 · AURORA

---

## 1. Unidade base

**4 px.** Toda medida de espaço, tamanho e posição é múltiplo de 4. Exceções
de 1–2 px existem apenas para bordas e ajuste óptico documentado.

## 2. Spacing scale

| Token      | Valor | Uso típico                              |
| ---------- | ----- | --------------------------------------- |
| `space-1`  | 4     | Gap entre ícone e texto                 |
| `space-2`  | 8     | Padding interno compacto, gaps de chips |
| `space-3`  | 12    | Padding de inputs, gap de listas densas |
| `space-4`  | 16    | Padding padrão de componentes           |
| `space-6`  | 24    | Padding de cards, gap entre blocos      |
| `space-8`  | 32    | Separação entre grupos                  |
| `space-12` | 48    | Separação entre seções                  |
| `space-16` | 64    | Respiro de seções de landing            |
| `space-24` | 96    | Blocos hero                             |
| `space-32` | 128   | Divisões monumentais (marketing)        |

## 3. Breakpoints

| Nome  | Min-width | Alvo                      |
| ----- | --------- | ------------------------- |
| `sm`  | 640 px    | Celular grande / paisagem |
| `md`  | 768 px    | Tablet                    |
| `lg`  | 1024 px   | Desktop                   |
| `xl`  | 1280 px   | Desktop largo             |
| `2xl` | 1536 px   | Monitores grandes         |

Mobile-first: estilos base são mobile; breakpoints adicionam.

## 4. Grid

### Desktop (≥1024)

- 12 colunas · gutter 24 px · margens 32 px.
- Container de app: fluido com `max-width` por página (ver §5).
- Container de marketing: `max-width 1280 px`, centrado.

### Tablet (768–1023)

- 8 colunas · gutter 24 px · margens 24 px.
- Sidebars colapsam para overlay.

### Mobile (<768)

- 4 colunas · gutter 16 px · margens 16 px.
- Uma intenção por dobra; navegação em drawer.

## 5. Container widths (conteúdo de app)

| Contexto              | Max-width                       |
| --------------------- | ------------------------------- |
| Leitura / formulários | 672 px (`max-w-2xl`)            |
| Listas e detalhes     | 896 px (`max-w-4xl`)            |
| Dashboards            | 1152 px (`max-w-6xl`) ou fluido |
| Marketing             | 1280 px (`max-w-7xl`)           |

## 6. Radius scale

| Token         | Valor   | Uso                             |
| ------------- | ------- | ------------------------------- |
| `radius-sm`   | 8 px    | Chips, badges, inputs compactos |
| `radius-md`   | 12 px   | Inputs, botões, itens de lista  |
| `radius-lg`   | 16 px   | Cards padrão (`rounded-2xl`)    |
| `radius-xl`   | 24 px   | Cards hero, modais grandes      |
| `radius-full` | 9999 px | Pills, avatares                 |

Nunca misturar dois radius diferentes em elementos irmãos do mesmo grupo.

## 7. Elevation scale (camadas)

| Nível | Nome       | Composição em dark                           |
| ----- | ---------- | -------------------------------------------- |
| 0     | Ambiente   | `surface.background`, sem borda              |
| 1     | Superfície | `surface.glass` + `border.default`           |
| 2     | Elevado    | `surface.glassHover` + `border.strong`       |
| 3     | Flutuante  | `surface.raised` sólido + sombra `shadow-lg` |
| 4     | Overlay    | Nível 3 sobre `surface.overlay` (scrim)      |

Em dark mode a elevação é comunicada por **luz** (fundo/borda mais claros);
a sombra só entra nos níveis 3–4.

## 8. Shadow scale

| Token                  | Valor                             | Uso                           |
| ---------------------- | --------------------------------- | ----------------------------- |
| `shadow-sm`            | `0 1px 2px rgba(2,6,23,.4)`       | Raro em dark; padrão em light |
| `shadow-md`            | `0 4px 12px rgba(2,6,23,.35)`     | Dropdowns                     |
| `shadow-lg`            | `0 12px 32px rgba(2,6,23,.45)`    | Modais, popovers              |
| `shadow-glow-platform` | `0 8px 32px rgba(37,99,235,.25)`  | CTA hero plataforma           |
| `shadow-glow-mkt`      | `0 8px 32px rgba(99,102,241,.25)` | CTA hero MKT                  |

Sombras-glow apenas em CTAs primários de destaque — nunca em cards de dados.

## 9. Z-index scale

| Token        | Valor | Uso          |
| ------------ | ----- | ------------ |
| `z-base`     | 0     | Conteúdo     |
| `z-raised`   | 10    | Cards sticky |
| `z-nav`      | 40    | Sidebar      |
| `z-header`   | 50    | Topbar fixa  |
| `z-dropdown` | 60    | Menus        |
| `z-overlay`  | 80    | Scrim        |
| `z-modal`    | 90    | Diálogos     |
| `z-toast`    | 100   | Notificações |

Valores fora da escala são proibidos (`z-index: 99999` é bug, não solução).
