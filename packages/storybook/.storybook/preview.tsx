import type { Preview, Decorator } from "@storybook/react";
import React from "react";
import { ShinaThemeProvider } from "@shina/theme";
import { ToastProvider } from "@shina/design-system";

// Todo componente é revisado nos dois eixos do sistema: modo (dark/light,
// doc 04 §9) e produto (platform/mkt, doc 02). Nenhuma história escapa
// dessas variações — é assim que o Storybook garante que a mesma linguagem
// funcione nos dois produtos.

const withShinaTheme: Decorator = (Story, context) => {
  const mode = context.globals.theme ?? "dark";
  const product = context.globals.product ?? "platform";
  return (
    <ShinaThemeProvider defaultPreference={mode} product={product}>
      <ToastProvider>
        <div
          style={{
            background: "var(--shina-surface-background)",
            color: "var(--shina-text-primary)",
            minHeight: "100vh",
            padding: 24,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <Story />
        </div>
      </ToastProvider>
    </ShinaThemeProvider>
  );
};

const preview: Preview = {
  parameters: {
    layout: "centered",
    backgrounds: { disable: true }, // o fundo vem do ShinaThemeProvider, não do addon
    a11y: { element: "#storybook-root" },
    options: {
      storySort: {
        order: [
          "Foundations",
          ["Colors", "Typography", "Spacing", "Motion"],
          "Components",
          "Landing",
          "AI Experience",
        ],
      },
    },
  },
  globalTypes: {
    theme: {
      name: "Tema",
      description: "Dark (padrão) ou Light — doc 04 §9",
      defaultValue: "dark",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
      },
    },
    product: {
      name: "Produto",
      description: "Acento de marca — doc 02",
      defaultValue: "platform",
      toolbar: {
        icon: "component",
        items: [
          { value: "platform", title: "Shinã (azul→ciano)" },
          { value: "mkt", title: "Marketing IA (índigo→violeta)" },
        ],
      },
    },
  },
  decorators: [withShinaTheme],
};

export default preview;
