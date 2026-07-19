import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "rules/**/fixtures/"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // The scan path must never execute or import scanned content (CLAUDE.md §9).
    files: ["src/**"],
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "child_process", message: "The scanner never spawns processes." },
            { name: "node:child_process", message: "The scanner never spawns processes." },
            { name: "vm", message: "The scanner never evaluates scanned content." },
            { name: "node:vm", message: "The scanner never evaluates scanned content." },
          ],
        },
      ],
    },
  },
);
