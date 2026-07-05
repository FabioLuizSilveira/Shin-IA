import type { Meta, StoryObj } from "@storybook/react";
import { FlowBackground } from "@shina/flow-engine";

// Doc 16 — Background System. Um efeito dominante por viewport; nunca poluir.

const frame = { width: 480, height: 200, borderRadius: 12, overflow: "hidden" } as const;

const meta: Meta = {
  title: "Foundations/Backgrounds",
  parameters: {
    docs: {
      description: {
        component:
          "Dashboard (chapado), Aurora (heros/splash) e Flow (hero de plataforma) — nunca mais de um efeito dominante.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Dashboard: Story = {
  render: () => (
    <div style={frame}>
      <FlowBackground variant="dashboard" />
    </div>
  ),
};

export const Aurora: Story = {
  render: () => (
    <div style={frame}>
      <FlowBackground variant="aurora" />
    </div>
  ),
};

export const Hero: Story = {
  render: () => (
    <div style={frame}>
      <FlowBackground variant="hero" />
    </div>
  ),
};

export const HeroMkt: Story = {
  render: () => (
    <div style={frame}>
      <FlowBackground variant="hero" product="mkt" />
    </div>
  ),
};
