import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";

export default defineConfig([
  globalIgnores(["**/build/", "**/_worker.bundle.js", "**/.wrangler/", "**/functions/", "**/node_modules/"]),
  {
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      ecmaVersion: 2020,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-console": "off",
      "no-undef": "off",
      "no-redeclare": "off",
      "no-useless-escape": "off",
      "no-control-regex": "off",
      "no-empty": "off",
      "no-fallthrough": "off",
      "no-case-declarations": "off",
    },
  },
]);
