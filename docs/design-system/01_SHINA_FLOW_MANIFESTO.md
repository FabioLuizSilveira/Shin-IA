# 01 — Shinã Flow Manifesto

> Shinã Flow Design System™ · Wave 1 · AURORA

O Shinã Flow existe para materializar uma única frase: **Operações Inteligentes
em Movimento**. Estes dez pilares são a constituição visual e comportamental de
todos os produtos Shinã. Em conflito entre pilares, a ordem abaixo é a ordem de
prioridade.

---

## 1. Intelligence

A inteligência aparece no resultado, nunca no espetáculo.

- **Exemplo**: um insight de IA chega como uma frase clara com a fonte dos
  dados e uma ação sugerida.
- **Anti-exemplo**: partículas animadas, "cérebros" pulsando, spinners
  temáticos de IA, respostas enfeitadas com emojis de robô.
- **Teste**: se remover a palavra "IA" da tela, ela continua útil? Deve.

## 2. Flow

Todo fluxo tem começo, meio e fim visíveis. O usuário nunca fica sem saber o
próximo passo.

- **Exemplo**: criar campanha → revisar → aprovar → acompanhar, com o estado
  atual sempre nomeado (badge de status).
- **Anti-exemplo**: modal sobre modal; salvar que não confirma; ação que
  termina em tela morta.
- **Teste**: consegue desenhar o fluxo como uma linha? Se vira um novelo, corte.

## 3. Focus

Uma tela, uma intenção primária. Tudo o mais é secundário e parece secundário.

- **Exemplo**: página de aprovação destaca o payload e dois botões; o resto é
  quieto.
- **Anti-exemplo**: cinco CTAs coloridos disputando o mesmo quadrante.
- **Teste**: aperte os olhos até desfocar — o elemento mais visível é a ação
  principal?

## 4. Calm

Interfaces Shinã não gritam. Cor forte é reservada para significado.

- **Exemplo**: fundo `slate-950`, texto neutro, um único acento indigo no CTA.
- **Anti-exemplo**: vermelho para tudo que é importante; badges saturados em
  todas as linhas de tabela.
- **Teste**: quantos pixels saturados existem na tela? Menos de 10% da área.

## 5. Depth

Profundidade por luz e camadas, não por bordas pesadas.

- **Exemplo**: card glass (`bg branco 4%`, borda branca 8%, blur) sobre fundo
  escuro com um glow suave atrás do herói.
- **Anti-exemplo**: sombras pretas duras estilo 2012; bordas 2px cinza-médio.
- **Teste**: as camadas continuam legíveis com o monitor a 50% de brilho?

## 6. Precision

Alinhado ao grid, espaçado pela escala, escrito sem gordura.

- **Exemplo**: paddings sempre múltiplos de 4; rótulos com uma linha.
- **Anti-exemplo**: `margin: 13px`, textos que quebram sozinhos por preguiça
  de editar.
- **Teste**: inspecione qualquer medida — pertence à escala do documento 06?

## 7. Elegance

Elegância é o que sobra quando nada falta e nada sobra.

- **Exemplo**: tabela com linhas separadas por 1px branco 5%, sem zebra.
- **Anti-exemplo**: ícone + emoji + badge + tooltip no mesmo item de menu.
- **Teste**: remova um elemento; a tela piorou? Se não, ele nunca deveria
  estar lá.

## 8. Motion

Movimento comunica causalidade e continuidade. Nunca decoração.

- **Exemplo**: painel expande em 250 ms ease-out a partir do elemento clicado.
- **Anti-exemplo**: entradas em cascata de 2 segundos a cada navegação;
  bounce em botão de salvar.
- **Teste**: a animação responde à pergunta "de onde isso veio?" Se não, corte.

## 9. Scalability

Cada decisão visual deve sobreviver a 10× mais dados, idiomas maiores e novos
produtos.

- **Exemplo**: layout que degrada de 4 → 2 → 1 colunas sem regras especiais.
- **Anti-exemplo**: título que só cabe porque o nome do produto tem 8 letras.
- **Teste**: funciona com 1 item e com 1.000? Em alemão?

## 10. Enterprise

Confiabilidade visível: estados de erro dignos, permissões claras, auditoria
presente, aprovação humana em ações críticas tratada como recurso — não como
atrito.

- **Exemplo**: "Nada vai ao ar sem aprovação humana" dito na interface, com o
  histórico de decisões a um clique.
- **Anti-exemplo**: esconder o erro atrás de um toast genérico "Algo deu
  errado".
- **Teste**: um auditor entenderia o que aconteceu só olhando a tela?

---

## Como usar este manifesto

Antes de aprovar qualquer tela, percorra os dez pilares como checklist.
O documento 03 transforma isso em perguntas objetivas. Uma tela que falha em
Focus ou Calm volta para a prancheta, sem exceção.
