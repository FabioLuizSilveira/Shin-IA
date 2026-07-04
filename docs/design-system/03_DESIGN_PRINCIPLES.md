# 03 — Design Principles

> Shinã Flow Design System™ · Wave 1 · AURORA

Os princípios traduzem o Manifesto (doc 01) em decisões verificáveis. Toda
tela, componente ou feature passa por este checklist **antes** do merge.

---

## Os nove princípios operacionais

### P1 — Foco

Existe uma única intenção primária por tela, e ela domina a hierarquia.

- A ação principal usa a cor primária; todas as demais são neutras.
- Máximo de 1 CTA primário visível por viewport.

### P2 — Simplicidade

Cada elemento justifica sua existência. Complexidade vai para camadas
progressivas (expandir, drawer, detalhe), nunca para a superfície.

- Se uma feature precisa de explicação, o problema é o desenho, não o usuário.

### P3 — Espaço

O espaço negativo é um componente. Densidade é escolha deliberada, não
acidente.

- Respiração mínima entre blocos: `24px`. Entre seções: `48px`.
- Nenhum texto encosta em borda de container.

### P4 — Hierarquia

O olho percorre a tela na ordem da importância: título → dado-chave → ação →
suporte.

- No máximo 3 níveis tipográficos por tela (além de labels).
- Tamanho, peso e cor mudam juntos — nunca só um deles gritando.

### P5 — Movimento

Animação existe para explicar origem, destino ou progresso.

- Durações: 150 ms (micro), 250 ms (padrão), 400 ms (estrutural).
- Easing padrão `ease-out`; nada de bounce/elastic em produto.
- `prefers-reduced-motion` sempre respeitado.

### P6 — Calma

Saturação é orçamento: gasta-se onde há significado.

- Cores semânticas (verde/âmbar/vermelho) só para estado real.
- Nunca dois alertas visuais competindo na mesma dobra.

### P7 — Elegância

Acabamento consistente: radius da escala, bordas de 1px translúcidas,
alinhamento óptico revisado.

- Ícones e texto adjacentes alinham pela linha média, não pela caixa.

### P8 — Profundidade

Camadas contam a história: fundo (ambiente) → superfície (conteúdo) →
elevação (foco) → overlay (decisão).

- Cada camada acima soma luz (borda/preenchimento mais claros), não sombra
  mais preta.

### P9 — Inteligência

O sistema antecipa: defaults certos, estados vazios que ensinam, erros que
dizem como resolver, IA integrada ao fluxo com fonte e ação.

- Todo empty state tem: o que é, por que importa, primeiro passo.
- Toda mensagem de erro tem: o que houve + como resolver.

---

## Checklist de qualidade (gate de tela)

Responda **SIM** a todas antes de aprovar:

**Foco e hierarquia**

- [ ] Há uma única ação primária evidente?
- [ ] A ordem visual corresponde à ordem de importância?
- [ ] Há no máximo 3 níveis tipográficos?

**Espaço e calma**

- [ ] Todos os espaçamentos pertencem à escala (doc 06)?
- [ ] Menos de 10% da área usa cor saturada?
- [ ] Cores semânticas aparecem apenas com significado real?

**Profundidade e elegância**

- [ ] As camadas seguem fundo → superfície → elevação → overlay?
- [ ] Existe no máximo um glow dominante?
- [ ] Bordas e radius vêm das escalas oficiais?

**Movimento**

- [ ] Toda animação explica origem, destino ou progresso?
- [ ] Nenhuma duração excede 400 ms?
- [ ] `prefers-reduced-motion` é respeitado?

**Inteligência e Enterprise**

- [ ] Empty states ensinam o primeiro passo?
- [ ] Erros dizem como resolver?
- [ ] Estados de permissão/aprovação são visíveis e dignos?
- [ ] Funciona com 1 item e com 1.000?

**Acessibilidade**

- [ ] Contraste de texto ≥ 4.5:1 (corpo) e ≥ 3:1 (display)?
- [ ] Toda interação é alcançável por teclado?
- [ ] Estados de foco são visíveis?

Uma resposta **NÃO** = a tela volta. Duas exceções documentadas por escrito
são o máximo tolerado por release, com aprovação do design lead.
