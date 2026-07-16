import type { Meta, StoryObj } from "@storybook/react";
import { GlassCard, Button } from "@shina/design-system";

const meta: Meta<typeof GlassCard> = {
  title: "Components/GlassCard",
  component: GlassCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Doc 08 §4 / 10 Grupo B. Superfície padrão de conteúdo — glass em até 2 níveis empilhados.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof GlassCard>;

export const Default: Story = {
  render: () => (
    <GlassCard style={{ width: 320 }}>
      <p style={{ margin: 0, fontWeight: 700 }}>Título do card</p>
      <p style={{ marginTop: 8, opacity: 0.7, fontSize: 13 }}>
        Conteúdo de suporte em glass padrão.
      </p>
    </GlassCard>
  ),
};

export const Interactive: Story = {
  render: () => (
    <GlassCard interactive style={{ width: 320 }} onClick={() => alert("clicado")}>
      <p style={{ margin: 0, fontWeight: 700 }}>Card clicável</p>
      <p style={{ marginTop: 8, opacity: 0.7, fontSize: 13 }}>Hover Lift ativo (doc 11).</p>
    </GlassCard>
  ),
};

export const RingWarning: Story = {
  render: () => (
    <GlassCard ring="warning" style={{ width: 320 }}>
      <p style={{ margin: 0, fontWeight: 700 }}>Pendente de aprovação</p>
    </GlassCard>
  ),
};

export const Elevation2: Story = {
  render: () => (
    <GlassCard elevation={2} style={{ width: 320 }}>
      <p style={{ margin: 0, fontWeight: 700 }}>Elevação 2</p>
      <div style={{ marginTop: 12 }}>
        <Button size="sm">Ação</Button>
      </div>
    </GlassCard>
  ),
};
