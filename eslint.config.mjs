import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/build/**",
      "**/.turbo/**",
      ".changeset/**",
      "autoloc.shinaia.com.br-main/**",
    ],
  },
];
