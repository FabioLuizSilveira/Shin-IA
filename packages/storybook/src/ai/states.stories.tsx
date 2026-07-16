import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  NeuralParticles,
  ThinkingIndicator,
  StreamingText,
  NeuralLoader,
  GlowPulse,
} from "@shina/flow-engine";
import { Button } from "@shina/design-system";
import { Sparkles } from "@shina/icons";

// Doc 12 — AI Experience. Nunca "Loading…" nem spinner: nós, conexões e luz.

const meta: Meta = {
  title: "AI Experience/States",
  parameters: {
    docs: {
      description: {
        component:
          "A máquina de estados viva da IA Shinã (doc 12): Idle → Thinking → Streaming → Finished. Cada estado tem motion, ícone e texto próprios — nunca um spinner tradicional.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Idle: Story = {
  render: () => (
    <GlowPulse>
      <Sparkles size={28} />
    </GlowPulse>
  ),
};

export const Thinking: Story = {
  render: () => <ThinkingIndicator label="Analisando sua marca" />,
};

export const Searching: Story = {
  render: () => <ThinkingIndicator substate="searching" />,
};

export const NeuralConstellation: Story = {
  render: () => <NeuralParticles nodes={9} mode="thinking" size={140} />,
};

export const Loader: Story = {
  render: () => <NeuralLoader label="Gerando anúncio…" />,
};

export const Streaming: Story = {
  render: () => {
    const [key, setKey] = useState(0);
    return (
      <div style={{ maxWidth: 420 }}>
        <Button size="sm" onClick={() => setKey((k) => k + 1)} style={{ marginBottom: 12 }}>
          Reproduzir streaming
        </Button>
        <p key={key} style={{ fontSize: 14 }}>
          <StreamingText text="Encontrei 12 anúncios de concorrentes com esse ângulo — o com melhor performance está no seu swipe file." />
        </p>
      </div>
    );
  },
};

export const FullSequence: Story = {
  name: "Sequência completa (Thinking → Streaming)",
  render: () => {
    const [phase, setPhase] = useState<"idle" | "thinking" | "streaming">("idle");
    return (
      <div style={{ maxWidth: 420 }}>
        <Button size="sm" onClick={() => setPhase("thinking")} style={{ marginBottom: 16 }}>
          Gerar insight
        </Button>
        {phase === "thinking" && (
          <ThinkingIndicator
            label="Analisando 30 dias de dados"
            onCancel={() => setPhase("idle")}
          />
        )}
        {phase === "streaming" && (
          <p style={{ fontSize: 14 }}>
            <StreamingText
              text="Suas campanhas no Meta têm CTR 40% acima da média do setor nas últimas duas semanas."
              onDone={() => {}}
            />
          </p>
        )}
        {phase === "thinking" && (
          <div style={{ marginTop: 8 }}>
            <Button size="sm" variant="ghost" onClick={() => setPhase("streaming")}>
              (demo) avançar para streaming
            </Button>
          </div>
        )}
      </div>
    );
  },
};
