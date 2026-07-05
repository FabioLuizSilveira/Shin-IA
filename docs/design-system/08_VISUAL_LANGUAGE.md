# 08 — Visual Language

> Shinã Flow Design System™ · Wave 1 · AURORA

Este documento descreve **como uma interface Shinã parece** — a ponto de um
designer construí-la sem ver nenhum exemplo. A imagem-guia: uma sala de
controle premium à noite; água escura com luz se movendo por baixo.

---

## 1. Espaço negativo

O vazio é o material mais caro do sistema — gaste-o generosamente.

- Toda tela tem ao menos uma zona de silêncio (≥ `space-12`) que separa a
  intenção primária do resto.
- Densidade é progressiva: visão geral arejada → detalhe denso sob demanda.
- Se dois blocos disputam espaço, um deles vira camada (drawer/expand).

## 2. Luz

Em dark mode, luz = informação. A hierarquia luminosa é:

1. Texto branco (títulos e dados-chave) — a luz mais forte.
2. Primária do produto (ações e acentos).
3. Glow ambiente (atmosfera, atrás de tudo).
4. Bordas translúcidas (arquitetura).

A luz nunca vem "de cima" como sombra invertida; ela **emana do conteúdo**.

## 3. Glow

- Função: indicar vida e importância ambiente, nunca decorar.
- Receita: mancha radial da primária a 8–12%, blur ≥ 64 px, posicionada atrás
  do herói ou do quadrante de maior importância.
- Limite: **1 glow dominante por viewport** + no máximo 1 secundário a ≤ 6%.
- Glow nunca toca texto de corpo, nunca aparece em light mode, nunca pisca.

## 4. Glass

Superfície padrão de conteúdo em dark:

```
background: rgba(255,255,255,0.04)
border: 1px solid rgba(255,255,255,0.08)
backdrop-filter: blur(8px)
radius: 16px (radius-lg)
```

- Hover: fundo sobe para 6–7%; borda para 12–16%.
- Glass empilha no máximo **2 níveis** (card glass dentro de seção glass é o
  teto; três níveis viram névoa).
- Sobre glass, blocos internos usam `rgba(255,255,255,0.05)` sem blur.

## 5. Camadas e profundidade

Modelo mental de 5 camadas (ver elevação, doc 06 §7):

```
[4] Overlay      → decisões (modais, confirmação)
[3] Flutuante    → menus, popovers
[2] Elevado      → hover, item selecionado
[1] Superfície   → cards, painéis (glass)
[0] Ambiente     → fundo navy/black + glow
```

Cada salto de camada muda **duas** propriedades no máximo (fundo + borda, ou
fundo + sombra). Mudar tudo de uma vez destrói a continuidade.

## 6. Cards

- Anatomia: padding `space-6` (dashboards) ou `space-4` (listas densas);
  título H4/H5; metadado Small em gray-400; ação no canto ou rodapé.
- Um card = uma entidade ou um agregado. Nunca dois assuntos no mesmo card.
- Cards clicáveis inteiros não contêm outros cliques concorrentes (exceto
  menu `⋯`).
- Destaque de estado por **ring** translúcido (ex.: `ring-1` âmbar para
  pendências), nunca por fundo saturado.

## 7. Hero (marketing e cabeçalhos de produto)

- Fundo `#020617` com um glow da marca ancorado atrás do título.
- Eyebrow (Overline) opcional → Display → subtítulo Body Large em gray-400 →
  1 CTA primário + 1 secundário fantasma.
- Uma única palavra ou expressão pode receber gradiente de texto.
- Elementos flutuantes decorativos: no máximo dois, desfocados, nunca sobre o
  texto.

## 8. Dashboard

- Grade de KPIs no topo (cards glass uniformes, número em H2/`font-black`,
  rótulo Small).
- Ordem de leitura: estado do sistema → pendências que exigem ação → conteúdo
  recente.
- Pendências urgentes usam ring âmbar; nunca banners vermelhos permanentes.
- Gráficos com a sequência categórica do doc 04 §7, sem fundos zebrados, grid
  lines a `border.subtle`.

## 9. Background

- App: `#0F172A` chapado. Marketing: `#020617` com glows.
- Proibido: imagens de fundo, padrões geométricos repetidos, vídeos em loop
  atrás de conteúdo funcional.
- Ruído (noise): permitido apenas em marketing, monocromático, opacidade
  ≤ 3%, para eliminar banding de gradientes — invisível a olho consciente.

## 10. Bordas e contraste

- Bordas são translúcidas brancas (doc 04 §5); bordas de cor só em estado
  (foco, erro, seleção).
- Divisores: 1 px `border.subtle`; nunca dois divisores paralelos a menos de
  `space-4`.
- Contraste segue doc 04 §10; brilho máximo (branco puro) reservado a títulos
  e valores-chave.

## 11. Texturas e gradientes

- Gradientes = marca (tokens do doc 04 §8). Não inventar gradientes ad hoc.
- Superfícies nunca recebem gradiente de preenchimento; gradiente vive em
  tiles de marca, CTAs hero e texto display.

## 12. O que a Shinã nunca parece

- **Cyberpunk exagerado**: neon saturado, scanlines, glitch, verde-matrix.
- **Neon publicitário**: contornos brilhantes em tudo, bloom estourado.
- **Template**: hero genérico com blob 3D roxo padrão de marketplace.
- **Admin LTE / ERP tradicional**: cinza-azulado chapado, tabelas zebradas,
  ícones coloridos aleatórios, breadcrumbs triplos.
- **Brutalismo cru**: bordas pretas 3px, amarelo taxi, tipografia serifada
  gigante.

Se uma tela lembra qualquer item desta lista, ela falhou o gate — recomeçe
pelo doc 03.
