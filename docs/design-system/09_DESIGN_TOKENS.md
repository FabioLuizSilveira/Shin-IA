# 09 — Design Tokens

> Shinã Flow Design System™ · Wave 1 · AURORA
> **Documentação de arquitetura.** A implementação (Wave 2) criará o pacote
> `@shina/flow-tokens`; nesta Wave nenhum código é escrito.

---

## 1. Arquitetura

Três camadas, sempre nesta direção de referência:

```
PRIMITIVOS  →  SEMÂNTICOS  →  COMPONENTES (Wave 2+)
(blue-600)     (color.action.primary)   (button.bg)
```

- **Primitivos**: valores brutos das escalas (docs 04–06). Nunca usados
  diretamente em telas.
- **Semânticos**: nomeiam intenção (`surface.glass`, `text.secondary`).
  São o vocabulário das interfaces.
- **Componentes**: aliases por componente, definidos na Wave 2.

Fonte da verdade: um único diretório TypeScript, consumido por Tailwind, CSS
Variables, React, Figma (via export JSON) e Storybook.

## 2. Estrutura de arquivos (contrato para a Wave 2)

```
packages/flow-tokens/src/
  colors.ts       → primitivos: escalas blue/purple/cyan/gray + semânticas
  surface.ts      → background, deep, raised, glass, glassHover, overlay
  gradients.ts    → platform, mkt, mktText, success
  glow.ts         → platform, mkt, accent (cor, opacidade, blur)
  glass.ts        → receita glass: bg, border, blur, hover
  shadow.ts       → sm/md/lg + glow-platform/glow-mkt
  spacing.ts      → space-1..32 (base 4)
  radius.ts       → sm/md/lg/xl/full
  typography.ts   → famílias, escala completa (tamanho/leading/peso/tracking)
  motion.ts       → durações (150/250/400), easings, reduced-motion
  theme.ts        → composição dark (padrão) e light; produto: platform | mkt
  index.ts        → export agregado + tipo ShinaTheme
```

## 3. Convenção de nomes

`categoria.grupo.variante[.estado]`, kebab-case em CSS, camelCase em TS:

| TS                     | CSS Variable            | Tailwind           |
| ---------------------- | ----------------------- | ------------------ |
| `colors.blue[600]`     | `--shina-blue-600`      | `text-blue-600`    |
| `surface.glass`        | `--shina-surface-glass` | `bg-surface-glass` |
| `space[6]`             | `--shina-space-6`       | `p-6` (mapa 1:1)   |
| `motion.duration.base` | `--shina-duration-base` | `duration-250`     |

Prefixo `--shina-` em todas as variáveis CSS; sem prefixo dentro do TS.

## 4. Especificação por arquivo

### colors.ts

Exporta as escalas 50–950 dos docs 04 §1–2 e o objeto `semantic`
(success/warning/danger/info com `base`, `bg`, `text`, `border`).

### surface.ts / glass.ts

Valores do doc 04 §4 e a receita do doc 08 §4. `glass` inclui `blur: 8` como
número (px) para uso programático.

### gradients.ts / glow.ts

Strings CSS prontas + componentes decompostos (`from`, `to`, `angle: 135`)
para consumo em SVG/Canvas/Figma.

### shadow.ts

Doc 06 §8. Sombras-glow marcadas com `restricted: true` (lint da Wave 2
alertará uso fora de CTA hero).

### spacing.ts / radius.ts

Docs 06 §2 e §6. Exportar também `zIndex` (doc 06 §9).

### typography.ts

Doc 05: `fontFamily`, e um registro `styles` com os 16 estilos nomeados
(`displayXXL` … `code`), cada um `{ size, lineHeight, weight, tracking,
family, responsive?: { md, sm } }`.

### motion.ts

```
duration: { fast: 150, base: 250, slow: 400 }
easing:   { out: cubic-bezier(0,0,0.2,1), inOut: cubic-bezier(0.4,0,0.2,1) }
reducedMotion: obrigatório — helpers devem gerar variantes none
```

### theme.ts

Composição final: `createTheme({ mode: "dark" | "light", product:
"platform" | "mkt" })` retorna o conjunto semântico resolvido (primária,
gradiente, glow do produto; superfícies do modo). Dark é o default; light
remove glow/glass conforme doc 04 §9.

## 5. Consumo por plataforma

- **Tailwind**: `tailwind.config` importa os tokens e estende `colors`,
  `spacing`, `borderRadius`, `boxShadow`, `fontFamily`, `transitionDuration`.
  Os configs atuais de `apps/*` migram para esse preset compartilhado na
  Wave 2 (`presets: [shinaFlowPreset]`).
- **CSS Variables**: build gera `tokens.css` com `:root` (dark) e
  `[data-theme="light"]`; produto via `[data-product="mkt"]`.
- **React**: hook `useShinaTheme()` expõe o tema resolvido para styled
  inline, gráficos e canvas.
- **Figma**: export `tokens.figma.json` no formato Tokens Studio; sincroniza
  Variables de cor, número e string.
- **Storybook**: consome o preset Tailwind + `tokens.css`; página "Tokens"
  gerada automaticamente a partir do index.

## 6. Governança

- Tokens primitivos só mudam com atualização dos docs 04–06 no mesmo PR.
- Nenhuma tela usa valor bruto: cor hex, px de espaçamento ou sombra fora dos
  tokens é reprovado em review (lint automatizado na Wave 2).
- Versionamento semver do pacote; breaking = major + changelog com mapa de
  migração.
- Depreciação: token antigo permanece 1 minor emitindo aviso antes de sumir.

## 7. Exemplo de resolução ponta a ponta

Pedido de tela: "card de KPI com destaque de pendência".

1. Superfície: `surface.glass` + `border.default`, `radius.lg`,
   padding `space-6`.
2. Rótulo: estilo `small` em `text.secondary` (gray-400).
3. Valor: estilo `h2` em `text.title` (white), `tabular-nums`.
4. Ícone: `icon-md` em `color.accent` (primária-400 do produto).
5. Pendência: `ring 1px` `semantic.warning.border`.
6. Hover: `surface.glassHover`, transição `motion.duration.fast`.

Nenhum valor bruto foi citado — este é o padrão de comunicação entre design e
engenharia a partir de agora.
