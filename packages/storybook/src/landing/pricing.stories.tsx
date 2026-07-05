import type { Meta, StoryObj } from "@storybook/react";
import { Pricing } from "@shina/landing";
import { Button } from "@shina/design-system";

const meta: Meta<typeof Pricing> = {
  title: "Landing/Pricing",
  component: Pricing,
  parameters: {
    docs: {
      description: { component: "Doc 10. Nunca mais de um plano destacado (ring accent) por vez." },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Pricing>;

export const Default: Story = {
  args: {
    plans: [
      {
        id: "free",
        name: "Free",
        price: "R$0",
        period: "para sempre",
        description: "Para conhecer a plataforma.",
        features: ["1 marca", "5 gerações IA/mês", "Ad Library (5 buscas/dia)"],
        cta: (
          <Button variant="secondary" style={{ width: "100%" }}>
            Começar grátis
          </Button>
        ),
      },
      {
        id: "pro",
        name: "Pro",
        price: "R$399",
        period: "/ mês",
        description: "Para equipes de marketing em escala.",
        highlight: true,
        badge: "Mais popular",
        features: ["15 marcas e usuários", "Gerações ilimitadas", "MCP Server (agentes IA)"],
        cta: <Button style={{ width: "100%" }}>Assinar Pro</Button>,
      },
      {
        id: "business",
        name: "Business",
        price: "R$999",
        period: "/ mês",
        description: "Para agências multi-cliente.",
        features: ["Ilimitado", "API pública", "White-label"],
        cta: (
          <Button variant="secondary" style={{ width: "100%" }}>
            Falar com vendas
          </Button>
        ),
      },
    ],
  },
};
