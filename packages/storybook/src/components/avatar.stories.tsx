import type { Meta, StoryObj } from "@storybook/react";
import { Avatar } from "@shina/design-system";

const meta: Meta<typeof Avatar> = {
  title: "Components/Avatar",
  component: Avatar,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Initials: Story = { args: { name: "Fabio Silveira", size: "md" } };
export const WithStatus: Story = { args: { name: "Ana Costa", size: "md", statusDot: "online" } };

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Avatar name="Fabio Silveira" size="xs" />
      <Avatar name="Fabio Silveira" size="sm" />
      <Avatar name="Fabio Silveira" size="md" />
      <Avatar name="Fabio Silveira" size="lg" />
    </div>
  ),
};
