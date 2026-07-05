import type { Meta, StoryObj } from "@storybook/react";
import { Tabs } from "@shina/design-system";

const meta: Meta<typeof Tabs> = {
  title: "Components/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Doc 10 Grupo D. Sublinhado primária, conteúdo troca por crossfade.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  args: {
    items: [
      { id: "search", label: "Buscar anúncios", content: <p>Resultados de busca aqui.</p> },
      { id: "swipe", label: "Swipe File (12)", content: <p>Itens salvos aqui.</p> },
      { id: "competitors", label: "Concorrentes (5)", content: <p>Marcas monitoradas aqui.</p> },
    ],
  },
};
