import type { Meta, StoryObj } from "@storybook/react";
import { Hero } from "@shina/landing";
import { Button } from "@shina/design-system";
import { Bot } from "@shina/icons";

const meta: Meta<typeof Hero> = {
  title: "Landing/Hero",
  component: Hero,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Doc 10 Grupo landing. Fundo por FlowBackground (doc 16 Hero); no máx. 1 palavra com gradiente no título.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Hero>;

export const Platform: Story = {
  args: {
    eyebrow: (
      <>
        <Bot size={14} /> Agent-first: crie campanhas por linguagem natural
      </>
    ),
    title: (
      <>
        Operações Inteligentes
        <br />
        em Movimento
      </>
    ),
    subtitle: "Gerencie frota, operações e equipes com inteligência artificial, tudo conectado.",
    primaryCta: <Button variant="gradient">Começar agora grátis</Button>,
    secondaryCta: <Button variant="secondary">Ver funcionalidades</Button>,
  },
};

export const MarketingIA: Story = {
  args: {
    ...Platform.args,
    title: (
      <>
        Anúncios vencedores,
        <br />
        criados com IA
      </>
    ),
    subtitle:
      "Pesquise concorrentes, gere criativos e publique — com aprovação humana em cada etapa.",
    product: "mkt",
  },
};
