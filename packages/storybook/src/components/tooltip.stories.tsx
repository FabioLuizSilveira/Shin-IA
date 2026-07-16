import type { Meta, StoryObj } from "@storybook/react";
import { Tooltip, IconButton } from "@shina/design-system";
import { Trash2 } from "@shina/icons";

const meta: Meta<typeof Tooltip> = {
  title: "Components/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: () => (
    <Tooltip content="Excluir campanha">
      <IconButton icon={<Trash2 size={16} />} aria-label="Excluir" />
    </Tooltip>
  ),
};
