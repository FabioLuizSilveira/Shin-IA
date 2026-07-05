import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { CommandPalette, Button } from "@shina/design-system";
import { Megaphone, Wand2, Palette } from "@shina/icons";

function CommandPaletteDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Abrir Command Palette (⌘K)</Button>
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        groups={[
          {
            heading: "Navegação",
            items: [
              {
                id: "campaigns",
                label: "Ir para Campanhas",
                icon: <Megaphone size={16} />,
                onSelect: () => {},
              },
              {
                id: "brand",
                label: "Ir para Brand Kit",
                icon: <Palette size={16} />,
                onSelect: () => {},
              },
            ],
          },
          {
            heading: "Ações",
            items: [
              {
                id: "generate",
                label: "Gerar novo anúncio",
                icon: <Wand2 size={16} />,
                onSelect: () => {},
              },
            ],
          },
        ]}
      />
    </>
  );
}

const meta: Meta = {
  title: "Components/CommandPalette",
  component: CommandPaletteDemo,
  parameters: {
    docs: {
      description: {
        component:
          "Doc 10/19 Grupo F/6. Navegação total por teclado (↑↓ Enter Esc), resultados agrupados.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = { render: () => <CommandPaletteDemo /> };
