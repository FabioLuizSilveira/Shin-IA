import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { transitions } from "@shina/motion";
import { Button, GlassCard } from "@shina/design-system";

// Doc 11 — Motion System. Demonstra fade/slide/scale ao vivo com os presets
// oficiais (nunca CSS ad hoc) — clique para reproduzir a entrada.

function MotionDemo() {
  const [key, setKey] = useState(0);
  return (
    <div>
      <Button onClick={() => setKey((k) => k + 1)} style={{ marginBottom: 24 }}>
        Reproduzir entrada
      </Button>
      <div style={{ display: "flex", gap: 24 }}>
        {(["fade", "slideUp", "scaleIn"] as const).map((name) => (
          <div
            key={`${name}-${key}`}
            style={{
              animation: `shina-demo-${name} ${transitions.base.duration}s cubic-bezier(0.16,1,0.3,1)`,
            }}
          >
            <GlassCard style={{ width: 140, padding: 20, textAlign: "center" }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{name}</p>
            </GlassCard>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes shina-demo-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes shina-demo-slideUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes shina-demo-scaleIn { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: scale(1) } }
      `}</style>
      <p style={{ marginTop: 16, fontSize: 12, opacity: 0.6 }}>
        Duração: {transitions.base.duration}s · easing: ease-out (doc 11 §3) — nunca bounce/elastic.
      </p>
    </div>
  );
}

const meta: Meta = {
  title: "Foundations/Motion",
  component: MotionDemo,
};

export default meta;
type Story = StoryObj;

export const EntryAnimations: Story = { render: () => <MotionDemo /> };
