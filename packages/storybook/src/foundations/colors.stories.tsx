import type { Meta, StoryObj } from "@storybook/react";
import { blue, purple, cyan, gray, semantic, chartColors } from "@shina/tokens";

// Documentação viva do doc 04 (Color System). Cada escala aqui é a mesma
// que os componentes consomem via CSS variables — se este swatch mudar,
// o Storybook falhou em refletir a fonte da verdade.

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0" }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: hex,
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      />
      <span style={{ fontSize: 13, fontFamily: "monospace" }}>{name}</span>
      <span style={{ fontSize: 13, fontFamily: "monospace", opacity: 0.6 }}>{hex}</span>
    </div>
  );
}

function Scale({ title, scale }: { title: string; scale: Record<string, string> }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
      {Object.entries(scale).map(([tone, hex]) => (
        <Swatch key={tone} name={`${title.toLowerCase()}-${tone}`} hex={hex} />
      ))}
    </div>
  );
}

function ColorSystemDoc() {
  return (
    <div style={{ maxWidth: 480 }}>
      <Scale title="Blue" scale={blue} />
      <Scale title="Purple" scale={purple} />
      <Scale title="Cyan" scale={cyan} />
      <Scale title="Gray" scale={gray} />
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Semantic</h3>
        {Object.entries(semantic).map(([name, tone]) => (
          <Swatch key={name} name={name} hex={tone.base} />
        ))}
      </div>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
          Chart sequence (doc 04 §7)
        </h3>
        <div style={{ display: "flex", gap: 8 }}>
          {chartColors.map((c) => (
            <div key={c} style={{ width: 28, height: 28, borderRadius: 6, background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Foundations/Colors",
  component: ColorSystemDoc,
  parameters: {
    docs: { description: { component: "Escalas oficiais do doc 04 — Color System." } },
  },
};

export default meta;
type Story = StoryObj;

export const AllScales: Story = { render: () => <ColorSystemDoc /> };
