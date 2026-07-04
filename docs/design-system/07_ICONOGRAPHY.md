# 07 — Iconography

> Shinã Flow Design System™ · Wave 1 · AURORA

---

## 1. Biblioteca oficial

**Lucide** é a biblioteca padrão de todos os produtos Shinã. Já é dependência
de todos os apps e cobre 99% das necessidades.

**Custom icons** são criados apenas quando:

1. O conceito é proprietário da Shinã (monogramas, glifos de produto);
2. Lucide não possui equivalente e a necessidade é recorrente (≥3 telas);
3. O ícone participa da identidade (ex.: glifo de módulo no marketplace).

Custom icons seguem exatamente a gramática do Lucide (grade, stroke, radius) —
um observador não deve perceber que o ícone não é da biblioteca.

## 2. Grade e construção

- Grade de **24×24 px** com área viva de 20×20 (padding interno de 2 px).
- **Stroke 2 px**, `stroke-linecap: round`, `stroke-linejoin: round`.
- Cantos internos com radius ≥ 1 px (nada pontiagudo).
- Sem preenchimentos sólidos, exceto indicadores de estado ≤ 8 px (dots).

## 3. Tamanhos permitidos

| Token     | Tamanho | Uso                           |
| --------- | ------- | ----------------------------- |
| `icon-xs` | 12 px   | Inline em Caption/badges      |
| `icon-sm` | 16 px   | Botões, inputs, listas densas |
| `icon-md` | 20 px   | **Padrão** — navegação, cards |
| `icon-lg` | 24 px   | Destaques, empty states       |
| `icon-xl` | 32 px   | Ilustrativo em heros (raro)   |

Ícones nunca são redimensionados fora desses passos. Acima de 32 px usar o
ícone dentro de um **tile** (fundo `primária/10`, radius `lg`), nunca o traço
gigante sozinho.

## 4. Cor e estados

| Estado            | Cor                                     |
| ----------------- | --------------------------------------- |
| Padrão (neutro)   | gray-400 `#94A3B8`                      |
| Inativo           | gray-500 `#64748B`                      |
| Hover             | white ou primária-400 do produto        |
| Ativo/selecionado | primária-400 (`#60A5FA` / `#A78BFA`)    |
| Desabilitado      | gray-600 a 60%                          |
| Semântico         | tom 400 da cor semântica correspondente |

Regras:

- Ícone acompanha a cor do texto adjacente (herda `currentColor`).
- Transição de cor em 150 ms ease-out.
- Nunca aplicar gradiente em ícone de traço; gradiente vive no tile.

## 5. Ícone + texto

- Gap de `space-1` (4 px) para ícones sm; `space-2` (8 px) para md+.
- Alinhamento pela linha média do texto (flex `items-center`).
- Ícone à esquerda = categoria/identidade; à direita = ação/direção
  (chevrons, external link).

## 6. Tiles de ícone (padrão Shinã)

Para KPIs, features e módulos:

- Tile quadrado 40–44 px, `radius-lg`, fundo `primária/10`.
- Ícone md/lg no tom 400 da primária (ou branco sobre tile gradiente de
  marca).
- Um tile por card; tiles nunca lado a lado sem conteúdo entre eles.

## 7. Proibições

- Misturar bibliotecas (Heroicons, FontAwesome, Material Icons) — nunca.
- Emoji como ícone funcional (emoji só em conteúdo editorial, com parcimônia).
- Ícones com stroke ≠ 2 px ou preenchidos (filled) fora de dots de estado.
- Animações contínuas em ícones (exceto `Loader2` girando durante loading
  real).
- Duplo sentido: o mesmo ícone não pode significar duas coisas no produto
  (ex.: `Sparkles` = IA/produto MKT; nunca usar para "novidade").

## 8. Vocabulário canônico (extrato)

| Conceito              | Ícone Lucide              |
| --------------------- | ------------------------- |
| IA / geração          | `Sparkles`, `Wand2`       |
| Plataforma / energia  | `Zap`                     |
| Aprovação / segurança | `ShieldCheck`             |
| Campanhas             | `Megaphone`               |
| Biblioteca / pesquisa | `Library`, `Search`       |
| Clonagem              | `Copy`, `Layers`          |
| Agentes / MCP         | `Bot`                     |
| Financeiro / créditos | `Coins`, `DollarSign`     |
| Configurações         | `Settings`                |
| Chaves / BYOK         | `KeyRound`                |
| Perigo / excluir      | `Trash2`, `AlertTriangle` |

Novos conceitos entram nesta tabela via PR neste documento — o vocabulário é
governado, não improvisado.
