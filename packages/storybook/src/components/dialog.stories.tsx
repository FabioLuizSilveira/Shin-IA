import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Dialog, Button } from "@shina/design-system";

function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Abrir dialog</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Aprovar rascunho de campanha"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setOpen(false)}>Aprovar e aplicar</Button>
          </>
        }
      >
        Esta ação é a única forma de uma campanha sair do estado de rascunho. Nenhuma publicação
        acontece sem essa confirmação (safety layer).
      </Dialog>
    </>
  );
}

const meta: Meta = {
  title: "Components/Dialog",
  component: DialogDemo,
  parameters: {
    docs: {
      description: {
        component:
          "Doc 10 Grupo C. Foco preso, Esc fecha (exceto destructive), scrim + painel glass.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = { render: () => <DialogDemo /> };
