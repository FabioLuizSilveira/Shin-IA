import type { Meta, StoryObj } from "@storybook/react";
import { typography, type TypeStyle } from "@shina/tokens";

// Doc 05 — Typography. Cada estilo renderizado com seus valores reais de
// tamanho/peso/tracking, para conferência visual direta contra a spec.

function TypographyDoc() {
  return (
    <div style={{ maxWidth: 640 }}>
      {(Object.entries(typography) as [string, TypeStyle][]).map(([name, style]) => (
        <div
          key={name}
          style={{
            marginBottom: 20,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            paddingBottom: 16,
          }}
        >
          <p
            style={{
              fontSize: style.size,
              lineHeight: style.lineHeight,
              fontWeight: style.weight,
              letterSpacing: `${style.tracking}em`,
              fontFamily:
                style.family === "mono"
                  ? "monospace"
                  : style.family === "display"
                    ? "Manrope, sans-serif"
                    : "Inter, sans-serif",
              textTransform: style.uppercase ? "uppercase" : undefined,
              margin: 0,
            }}
          >
            {name} — Operações Inteligentes em Movimento
          </p>
          <span style={{ fontSize: 11, fontFamily: "monospace", opacity: 0.5 }}>
            {style.size}px · {style.weight} · {style.family} · tracking {style.tracking}
          </span>
        </div>
      ))}
    </div>
  );
}

const meta: Meta = {
  title: "Foundations/Typography",
  component: TypographyDoc,
};

export default meta;
type Story = StoryObj;

export const AllStyles: Story = { render: () => <TypographyDoc /> };
