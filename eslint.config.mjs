// ESLint flat config for the TypeScript workspaces (apps/*, packages/*).
// Legacy plain-JS tooling (scripts/, tests/) is intentionally not linted here: scripts/json2sql.js and
// scripts/daily.sh are frozen interfaces used by the daily data pipeline; tests/ is owned by QA.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '.wrangler/**',
      '**/.wrangler/**',
      'scripts/**',
      'tests/**',
      'sql/**',
      'data/**',
      '.ci-local/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict, ...tseslint.configs.stylistic],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts', '*.{mjs,mts}', 'apps/*/vite.config.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.worker } },
  },
);
