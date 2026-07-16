import type { StorybookConfig } from "@storybook/react-vite";

// Shinã Flow Storybook — fonte de verdade visual (doc "Storybook" da Wave 2.5).
// Toda alteração visual do design system é validada aqui antes de qualquer
// consumidor (apps/web, apps/mkt) subir para produção.

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)", "../src/**/*.mdx"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-interactions", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: { autodocs: "tag" },
};

export default config;
