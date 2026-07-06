import type { Meta, StoryObj } from "@storybook/react";
import { EmptyState, ErrorState, SuccessState, Button } from "@shina/design-system";
import { FlowIllustration, DriftIllustration } from "@shina/illustrations";
import { Bot } from "@shina/icons";

const meta: Meta = {
  title: "Components/States",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Wave 4 SUPERNOVA. Vazio, erro e sucesso nunca são genéricos — sempre título, explicação e um próximo passo.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Empty: Story = {
  render: () => (
    <EmptyState
      illustration={<FlowIllustration size={96} />}
      title="Nenhuma campanha ainda"
      description="Crie sua primeira campanha para começar a publicar com aprovação humana em cada etapa."
      aiHint={
        <>
          <Bot size={14} /> A IA sugere: comece importando seu Brand Kit.
        </>
      }
      action={<Button variant="gradient">Nova campanha</Button>}
    />
  ),
};

export const ErrorOffline: Story = {
  render: () => (
    <ErrorState
      code="offline"
      illustration={<DriftIllustration size={96} />}
      action={<Button variant="gradient">Tentar novamente</Button>}
    />
  ),
};

export const ErrorAiUnavailable: Story = {
  render: () => (
    <ErrorState
      code="ai-unavailable"
      illustration={<DriftIllustration size={96} />}
      action={<Button variant="gradient">Trocar provedor</Button>}
      secondaryAction={<Button variant="ghost">Tentar novamente</Button>}
    />
  ),
};

export const ErrorForbidden: Story = {
  render: () => <ErrorState code="forbidden" />,
};

export const Success: Story = {
  render: () => (
    <SuccessState
      title="Campanha publicada"
      description="Sua campanha já está no ar em Meta Ads e Google Ads."
      action={<Button variant="gradient">Ver campanha</Button>}
    />
  ),
};
