import type { Meta, StoryObj } from "@storybook/react";
import { Input, Textarea, Select } from "@shina/design-system";
import { Search } from "@shina/icons";

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Doc 10 Grupo B. Label acima, hint/erro abaixo, foco sempre visível.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = { args: { label: "Nome da marca", placeholder: "Minha Empresa" } };
export const WithHint: Story = {
  args: { label: "Nome da marca", hint: "Como aparece nos criativos gerados." },
};
export const WithError: Story = {
  args: { label: "Nome da marca", error: "Esse campo é obrigatório.", defaultValue: "" },
};
export const WithIcon: Story = {
  args: { label: "Buscar", icon: <Search size={16} />, placeholder: "Buscar anúncios..." },
};
export const Disabled: Story = {
  args: { label: "Nome da marca", disabled: true, value: "Bloqueado" },
};

export const TextareaExample: StoryObj<typeof Textarea> = {
  render: () => (
    <Textarea label="Briefing do anúncio" placeholder="Descreva o produto e o público-alvo..." />
  ),
};

export const SelectExample: StoryObj<typeof Select> = {
  render: () => (
    <Select label="Plataforma">
      <option>Meta (Facebook/Instagram)</option>
      <option>Google Ads</option>
      <option>TikTok</option>
    </Select>
  ),
};
