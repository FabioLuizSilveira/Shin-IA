# 17 — Sound System

> Shinã Flow Design System™ · Wave 2 · LUMEN
> **Guidelines apenas. Nada é implementado agora.** Som na Shinã é um
> sussurro, nunca um alarme. O padrão é silêncio; áudio é opcional,
> desligável e discretíssimo.

---

## Filosofia

A Shinã soa como a Shinã parece: calma, precisa, premium. Se o som chama
atenção para si, ele falhou. A referência sonora é a de sistemas operacionais
de alto padrão (o "toc" quase inaudível de confirmação), nunca games ou apps
de consumo festivos.

## Regras absolutas

1. **Opt-in e persistente** — som vem **desligado** por padrão; o usuário
   ativa e a preferência é lembrada por workspace/usuário.
2. **Discrição** — volume-alvo baixo; duração ≤ 200 ms (exceto ambiente);
   sem estridência, sem graves pesados.
3. **Significado** — cada som mapeia um evento real; nunca decoração.
4. **Não redundante em excesso** — nem toda micro-interação soa; só marcos.
5. **Acessibilidade** — som nunca é o único canal (sempre há feedback visual);
   respeita o silêncio do sistema/Do Not Disturb.
6. **Coerência tímbrica** — toda a paleta sonora vem de uma mesma família
   (timbres suaves, senoidais, com leve reverb curto), como se fosse um único
   instrumento.

## Paleta de sons (a definir na produção)

Formato: **evento · caráter sugerido · duração · nível.**

| Token                | Evento                               | Caráter                           | Duração  | Nível       |
| -------------------- | ------------------------------------ | --------------------------------- | -------- | ----------- |
| `sound.hover`        | Hover em alvo importante (dock, CTA) | Toque quase inaudível             | ≤ 40 ms  | Ultra baixo |
| `sound.command`      | Abrir Command Palette                | Sopro ascendente curto            | ≤ 120 ms | Baixo       |
| `sound.notification` | Nova notificação                     | Dois tons suaves                  | ≤ 150 ms | Baixo       |
| `sound.success`      | Ação concluída                       | Tom resolvido, cálido             | ≤ 180 ms | Baixo       |
| `sound.generate`     | IA começa a gerar                    | Textura crescente suave           | ≤ 150 ms | Ultra baixo |
| `sound.aiReady`      | IA entregou resultado                | Tom claro, "pronto"               | ≤ 180 ms | Baixo       |
| `sound.publish`      | Publicação/aprovação aplicada        | Confirmação encorpada porém suave | ≤ 200 ms | Baixo-médio |
| `sound.workspace`    | Troca de workspace/tenant            | Transição arejada                 | ≤ 200 ms | Baixo       |

Notas:

- **Hover** só soa em elementos de alto valor (dock, FAB, CTA hero), nunca em
  toda a interface — senão vira ruído.
- **Erro** deliberadamente **não** tem som próprio agressivo; se necessário,
  usa um tom neutro descendente muito discreto. A Shinã não pune com áudio.
- Ambiente (drones/paisagem sonora) **não** faz parte do sistema — nada toca em
  loop.

## Diretrizes técnicas (para a implementação futura)

- Formato leve (ex.: curtos `.webm`/`.mp3` ou WebAudio sintetizado);
  pré-carregados, sem latência perceptível (< 30 ms do gesto ao som).
- Mixagem normalizada entre todos os tokens (nenhum destoa em volume).
- Respeitar `prefers-reduced-motion` como sinal correlato de "ambiente
  reduzido" e qualquer configuração de acessibilidade de áudio do SO.
- Controle global (on/off + volume) em Configurações; mudo instantâneo.

## Gate para ativar áudio (Wave futura)

Só implementar quando: (a) a paleta inteira estiver desenhada por um único
sound designer para garantir coerência; (b) houver controle de usuário
completo; (c) testes confirmarem que, no volume-alvo, nenhum som incomoda em
uso prolongado. Até lá, **a Shinã é silenciosa** — e isso é uma escolha de
design, não uma ausência.
