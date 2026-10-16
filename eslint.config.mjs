import tseslint from "typescript-eslint";

/**
 * Shared flat config for the bankai server and dashboard workspaces.
 * Errors gate CI; stylistic rules that would flood an existing codebase are
 * warnings so they stay visible without blocking.
 */
export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.d.ts"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["apps/server/src/**/*.ts", "apps/dashboard/src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-require-imports": "warn",
    },
  },
);
