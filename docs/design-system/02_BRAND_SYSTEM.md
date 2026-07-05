# 02 — Brand System

> Shinã Flow Design System™ · Wave 1 · AURORA
> **BRAND LOCK**: nada neste documento pode ser alterado sem aprovação formal
> do responsável pela marca. Isto é registro, não proposta.

---

## 1. Arquitetura de marca

| Marca                  | Uso                                    | Acento           |
| ---------------------- | -------------------------------------- | ---------------- |
| **Shinã** (plataforma) | app.shinaia.com.br, site institucional | Azul → Ciano     |
| **Shinã Marketing IA** | mkt.shinaia.com.br, extensão Chrome    | Índigo → Violeta |

Produtos futuros seguem o padrão: wordmark "Shinã" + nome do produto, com um
gradiente de acento próprio derivado da paleta oficial.

## 2. Logotipo e monogramas

### Monograma S (plataforma)

- Símbolo: raio/energia branco sobre tile com gradiente Azul → Ciano
  (`#2563EB → #06B6D4`), cantos arredondados (radius ≈ 25% do lado).
- Constrói-se sobre grade quadrada de 32×32 unidades; o glifo ocupa a área
  central de 20×20.

### Monograma M (Marketing IA)

- Símbolo: faísca/sparkle branco sobre tile com gradiente Índigo → Violeta
  (`#6366F1 → #8B5CF6`), mesma grade e radius do S.
- Satélites (pontos de brilho) opcionais apenas em tamanhos ≥ 48 px.

### Wordmark

- "Shinã" em peso bold, tracking apertado (−1%), sempre com o til.
- No Marketing IA: "Shinã" branco + "Marketing IA" com o gradiente do produto
  aplicado como texto (`background-clip: text`).

## 3. Área de proteção e tamanho mínimo

- **Área de proteção**: em todos os lados, no mínimo a altura do tile ÷ 2
  ("regra do meio-S"). Nada entra nessa área: texto, bordas, outros logos.
- **Tamanho mínimo**:
  - Monograma: 16 px (favicon) — sem satélites, sem glow.
  - Monograma + wordmark: 96 px de largura.
  - Impressão: 8 mm de altura do tile.

## 4. Versões

| Versão                                 | Quando usar                            |
| -------------------------------------- | -------------------------------------- |
| Tile gradiente + glifo branco (padrão) | Sempre que possível                    |
| Monocromática branca                   | Sobre fotos escuras ou fundos de marca |
| Monocromática `#020617`                | Documentos claros, impressão P&B       |
| Glifo isolado                          | Favicon, avatar, espaços ≤ 24 px       |

Não existem versões outline, 3D, com sombra projetada ou rotacionadas.

## 5. Aplicação em fundos

- **Fundos escuros (padrão)**: `#0F172A` a `#020617`. O tile gradiente vive
  aqui; glow permitido (ver §8).
- **Fundos claros**: branco a `#E2E8F0`. Usar tile gradiente sem glow, ou
  versão monocromática escura. Nunca aplicar glow em fundo claro.
- **Sobre imagens**: apenas se houver zona de contraste ≥ 4.5:1; caso
  contrário, aplicar scrim escuro de 40% sob o logo.

## 6. Usos incorretos (proibidos)

- Alterar as cores do gradiente ou sua direção (sempre 135°, topo-esquerda →
  base-direita).
- Esticar, condensar, rotacionar, espelhar ou inclinar.
- Trocar a tipografia do wordmark ou remover o til.
- Aplicar sombra dura, contorno, bevel ou efeitos 3D.
- Colocar o monograma dentro de formas que não sejam o tile oficial.
- Usar o glow como preenchimento (glow é atmosfera, nunca tinta).
- Recriar o glifo com outro ícone de biblioteca.

## 7. Paleta oficial (resumo — sistema completo no doc 04)

| Token         | Hex       | Papel                          |
| ------------- | --------- | ------------------------------ |
| Shinã Black   | `#020617` | Fundo profundo                 |
| Shinã Navy    | `#0F172A` | Fundo padrão                   |
| Shinã Blue    | `#2563EB` | Primária da plataforma         |
| Shinã Cyan    | `#06B6D4` | Par do gradiente da plataforma |
| Shinã Green   | `#10B981` | Sucesso                        |
| Shinã Slate   | `#64748B` | Texto secundário               |
| Shinã Light   | `#E2E8F0` | Texto principal em dark        |
| MKT Primary   | `#6366F1` | Primária do Marketing IA       |
| MKT Secondary | `#8B5CF6` | Par do gradiente do MKT        |
| MKT Glow      | `#A78BFA` | Acento luminoso do MKT         |

## 8. Gradientes e Glow oficiais

- **Gradiente Plataforma**: `linear-gradient(135deg, #2563EB, #06B6D4)`
- **Gradiente Marketing IA**: `linear-gradient(135deg, #6366F1, #8B5CF6)`
- **Gradiente de texto MKT**: `linear-gradient(135deg, #6366F1, #A78BFA)`
- **Glow**: mancha radial da cor primária do produto a 8–12% de opacidade,
  raio grande (blur ≥ 64 px), sempre atrás do conteúdo, nunca sobre texto.
  Máximo de **um** glow dominante por viewport.

## 9. Exemplos canônicos

- Header de app: tile 32 px + wordmark 18 px, área de proteção respeitada,
  fundo `#0F172A`.
- Favicon: glifo isolado no tile, 16/32 px (`icon.svg` já versionado em cada
  app).
- Card de produto (página Apps): tile 44 px com gradiente do produto + nome +
  badge — nunca dois glows no mesmo card.
