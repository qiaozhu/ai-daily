// ESLint flat config for the TypeScript workspaces (apps/*, packages/*).
// Legacy plain-JS tooling (scripts/, tests/) is intentionally not linted here: scripts/json2sql.js and
// scripts/daily.sh are frozen interfaces used by the daily data pipeline; tests/ is owned by QA.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// apps/web runs the React API on preact/compat (docs/adr/0001-preact-compat.md). These React 19 APIs are not
// implemented there (they would be undefined at runtime / silently ignored), so CI rejects them.
// Self-test: tests/unit/eslint-preact-compat.test.mjs.
export const PREACT_COMPAT_UNSUPPORTED = [
  'use',
  'useActionState',
  'useOptimistic',
  'useFormStatus',
  'requestFormReset',
];
const unsupportedMsg = 'not supported by preact/compat (see docs/adr/0001-preact-compat.md)';
export const preactCompatRules = {
  'no-restricted-imports': [
    'error',
    {
      paths: ['react', 'react-dom'].map((name) => ({
        name,
        importNames: PREACT_COMPAT_UNSUPPORTED,
        message: `React 19 API ${unsupportedMsg}.`,
      })),
    },
  ],
  'no-restricted-syntax': [
    'error',
    {
      // React.use(...), ReactDOM.useFormStatus(...), etc. through a namespace / default import
      selector: `MemberExpression[property.name=/^(${PREACT_COMPAT_UNSUPPORTED.join('|')})$/][object.name=/^React(DOM)?$/]`,
      message: `React 19 API ${unsupportedMsg}.`,
    },
    {
      // form actions on DOM elements: <form action={fn}>, <button formAction={fn}> (a plain URL string and an
      // `action` prop of our own components are fine)
      selector:
        "JSXOpeningElement[name.name=/^(form|button|input)$/] > JSXAttribute[name.name=/^(action|formAction)$/] > JSXExpressionContainer:not([expression.type='Literal']):not([expression.type='TemplateLiteral'])",
      message: `Form actions (action={fn}) are ${unsupportedMsg}; use onSubmit.`,
    },
  ],
};

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
      ...preactCompatRules,
    },
  },
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts', '*.{mjs,mts}', 'apps/*/vite.config.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.worker } },
  },
);
