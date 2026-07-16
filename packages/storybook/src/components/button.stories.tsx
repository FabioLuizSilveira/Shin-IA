import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@shina/design-system";
import { Sparkles } from "@shina/icons";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost", "danger", "gradient"],
    },
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Doc 10 Grupo A. Um primário por dobra; verbo no label. `loading` substitui o conteúdo por NeuralLoader — nunca um spinner (doc 12/14).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { children: "Gerar anúncio", variant: "primary" } };
export const Secondary: Story = { args: { children: "Cancelar", variant: "secondary" } };
export const Ghost: Story = { args: { children: "Ver tudo", variant: "ghost" } };
export const Danger: Story = { args: { children: "Excluir", variant: "danger" } };
export const Gradient: Story = { args: { children: "Começar grátis", variant: "gradient" } };
export const WithIcon: Story = {
  args: { children: "Gerar com IA", icon: <Sparkles size={16} /> },
};
export const Loading: Story = { args: { children: "Gerando...", loading: true } };
export const Disabled: Story = { args: { children: "Indisponível", disabled: true } };

export const AllSizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
};
