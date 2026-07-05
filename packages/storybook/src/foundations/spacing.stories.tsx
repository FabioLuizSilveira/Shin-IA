import type { Meta, StoryObj } from "@storybook/react";
import { spacing, radius } from "@shina/tokens";

// Doc 06 — Spacing & Grid.

function SpacingDoc() {
  return (
    <div style={{ maxWidth: 480 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Spacing scale (base 4px)</h3>
      {Object.entries(spacing).map(([token, px]) => (
        <div
          key={token}
          style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}
        >
          <div
            style={{ width: px, height: 16, background: "var(--shina-primary)", borderRadius: 2 }}
          />
          <span style={{ fontSize: 12, fontFamily: "monospace" }}>
            space-{token} = {px}px
          </span>
        </div>
      ))}
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: "24px 0 12px" }}>Radius scale</h3>
      {Object.entries(radius).map(([token, px]) => (
        <div
          key={token}
          style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              background: "var(--shina-surface-glass)",
              border: "1px solid var(--shina-border-default)",
              borderRadius: Math.min(px, 40),
            }}
          />
          <span style={{ fontSize: 12, fontFamily: "monospace" }}>
            radius-{token} = {px}px
          </span>
        </div>
      ))}
    </div>
  );
}

const meta: Meta = {
  title: "Foundations/Spacing",
  component: SpacingDoc,
};

export default meta;
type Story = StoryObj;

export const AllTokens: Story = { render: () => <SpacingDoc /> };
