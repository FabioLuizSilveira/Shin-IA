import type { Meta, StoryObj } from "@storybook/react";
import { Table, Badge, EmptyState, Button } from "@shina/design-system";
import { Library } from "@shina/icons";

interface Row {
  name: string;
  platform: string;
  status: "draft" | "active" | "paused";
}

const rows: Row[] = [
  { name: "Black Friday 2026", platform: "Meta", status: "active" },
  { name: "Lançamento produto", platform: "Google", status: "draft" },
  { name: "Retargeting Q1", platform: "TikTok", status: "paused" },
];

const STATUS_LABEL: Record<Row["status"], string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
};

const meta: Meta = {
  title: "Components/Table",
  component: Table,
  parameters: {
    docs: {
      description: {
        component: "Doc 10 Grupo E. Sem zebra, linhas separadas por border.subtle, tabular-nums.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Table<Row>
      columns={[
        { key: "name", header: "Campanha", render: (r) => r.name },
        { key: "platform", header: "Plataforma", render: (r) => r.platform },
        {
          key: "status",
          header: "Status",
          render: (r) => (
            <Badge variant={r.status === "active" ? "success" : "neutral"}>
              {STATUS_LABEL[r.status]}
            </Badge>
          ),
        },
      ]}
      rows={rows}
      rowKey={(r) => r.name}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <Table<Row>
      columns={[{ key: "name", header: "Campanha", render: (r) => r.name }]}
      rows={[]}
      rowKey={(r) => r.name}
      emptyState={
        <EmptyState
          illustration={<Library size={40} />}
          title="Nenhuma campanha ainda"
          description="Crie um rascunho e aprove na Central de Aprovações."
          action={<Button>Nova campanha</Button>}
        />
      }
    />
  ),
};
