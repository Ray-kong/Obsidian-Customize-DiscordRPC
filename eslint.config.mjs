import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
  // Keep linting focused on source, not build output
  {
    ignores: ["node_modules/**", "dist/**", "build/**", "**/*.js"],
  },

  // Base JS rules
  js.configs.recommended,

  // TS rules (non-typechecked by default)
  ...tseslint.configs.recommended,

  // Obsidian plugin rules (includes manifest/LICENSE/etc checks)
  ...obsidianmd.configs.recommended,

  // TS-specific overrides (project-aware linting)
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      parserOptions: {
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
    rules: {
      // TypeScript already checks undefined vars/types; avoid false positives like `NodeJS` types.
      "no-undef": "off",

      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
      "@typescript-eslint/ban-ts-comment": "off",
      "no-prototype-builtins": "off",
      "@typescript-eslint/no-empty-function": "off",

      // Examples from the obsidianmd README (adjust as desired)
      "obsidianmd/sample-names": "off",
      "obsidianmd/prefer-file-manager-trash-file": "error",
    },
  },

  // Optional: the plugin's recommended config lint-checks dependencies in package.json.
  // If you don't want that in this repo, turn it off.
  {
    files: ["package.json"],
    rules: {
      "depend/ban-dependencies": "off",
    },
  },

  // Make `npm run lint` usable early on: keep these as warnings (they can be upgraded later).
  {
    files: ["**/*.ts"],
    rules: {
      "obsidianmd/ui/sentence-case": [
        "warn",
        {
          brands: ["GitHub", "Obsidian", "Discord"],
          acronyms: ["RPC", "URL"],
          ignoreRegex: [
            // Filenames / paths / URLs aren't "sentences"
            "^[a-z0-9-]+\\.md$",
            "^https?://",
          ],
          enforceCamelCaseLower: true,
        },
      ],
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
    },
  },

  // Node scripts/configs
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": "off",
    },
  },
);

