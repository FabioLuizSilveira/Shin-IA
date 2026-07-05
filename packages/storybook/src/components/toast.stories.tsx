import type { Meta, StoryObj } from "@storybook/react";
import { Button, useToast } from "@shina/design-system";

function ToastDemo() {
  const { show } = useToast();
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Button
        variant="secondary"
        onClick={() => show({ message: "Anúncio gerado com sucesso", variant: "success" })}
      >
        Success
      </Button>
      <Button
        variant="secondary"
        onClick={() => show({ message: "Chave de IA ausente", variant: "warning" })}
      >
        Warning
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          show({
            message: "Item arquivado",
            variant: "info",
            action: { label: "Desfazer", onClick: () => {} },
          })
        }
      >
        Com ação (Undo)
      </Button>
    </div>
  );
}

const meta: Meta = {
  title: "Components/Toast",
  component: ToastDemo,
  parameters: {
    docs: {
      description: {
        component:
          "Doc 10 Grupo C. Auto-dismiss 5s (pausa no hover), ação Undo opcional. Requer ToastProvider (já ativo no preview global).",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = { render: () => <ToastDemo /> };
