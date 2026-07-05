import type { Meta, StoryObj } from "@storybook/react";
import { MetricCard } from "@shina/design-system";
import { Megaphone, ShieldCheck } from "@shina/icons";

const meta: Meta<typeof MetricCard> = {
  title: "Components/MetricCard",
  component: MetricCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Doc 10 Grupo C/3. Um KPI, uma leitura instantânea — valor via MetricCounter.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof MetricCard>;

export const Default: Story = {
  args: { label: "Campanhas ativas", value: 24, icon: <Megaphone size={18} /> },
};

export const WithDelta: Story = {
  args: { label: "Campanhas ativas", value: 24, delta: 12, icon: <Megaphone size={18} /> },
};

export const AttentionNeeded: Story = {
  args: {
    label: "Drafts pendentes",
    value: 3,
    icon: <ShieldCheck size={18} />,
    attention: true,
  },
};

export const Grid: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 200px)", gap: 16 }}>
      <MetricCard label="Campanhas" value={24} icon={<Megaphone size={18} />} />
      <MetricCard label="Anúncios gerados" value={318} delta={8} icon={<Megaphone size={18} />} />
      <MetricCard label="Drafts pendentes" value={3} icon={<ShieldCheck size={18} />} attention />
    </div>
  ),
};
