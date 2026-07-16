import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "@shina/design-system";

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["neutral", "success", "warning", "danger", "info"] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Doc 10. Pill semântico — nunca sólido saturado (fundo translúcido + texto tom 400).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8 }}>
      <Badge variant="neutral">Rascunho</Badge>
      <Badge variant="info">Ativa</Badge>
      <Badge variant="success">Aprovada</Badge>
      <Badge variant="warning">Pendente</Badge>
      <Badge variant="danger">Rejeitada</Badge>
    </div>
  ),
};
