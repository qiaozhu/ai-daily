// Self-test of the preact/compat guard in eslint.config.mjs (docs/adr/0001-preact-compat.md): each React 19 API
// that preact/compat does not implement must be rejected in apps/web, and ordinary code must still pass.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const cwd = fileURLToPath(new URL('../..', import.meta.url));
const eslint = new ESLint({ cwd });
const FILE = 'apps/web/src/__preact_compat_fixture__.tsx';
async function rules(code) {
  const [res] = await eslint.lintText(code, { filePath: FILE });
  return res.messages.filter((m) => m.ruleId === 'no-restricted-imports' || m.ruleId === 'no-restricted-syntax');
}

describe('ESLint rejects React 19 APIs unsupported by preact/compat', () => {
  const bad = {
    'import { use }': "import { use } from 'react';\nexport const f = (p: Promise<number>) => use(p);",
    'import { useActionState }': "import { useActionState } from 'react';\nexport const f = useActionState;",
    'import { useOptimistic }': "import { useOptimistic } from 'react';\nexport const f = useOptimistic;",
    'import { useFormStatus } (react-dom)': "import { useFormStatus } from 'react-dom';\nexport const f = useFormStatus;",
    'import { useFormStatus } (react)': "import { useFormStatus } from 'react';\nexport const f = useFormStatus;",
    'React.use via namespace': "import * as React from 'react';\nexport const f = (p: Promise<number>) => React.use(p);",
    'React.useActionState via default': "import React from 'react';\nexport const f = React.useActionState;",
    '<form action={fn}>': 'const save = async () => {};\nexport const F = () => <form action={save} />;',
    '<button formAction={fn}>': 'const save = async () => {};\nexport const F = () => <button formAction={save} />;',
  };
  for (const [name, code] of Object.entries(bad)) {
    it(name, async () => {
      const msgs = await rules(code);
      assert.ok(msgs.length >= 1, `expected a restriction error, got ${JSON.stringify(msgs)}`);
      assert.match(msgs[0].message, /preact\/compat/);
    });
  }
  it('ordinary React code is allowed (hooks, form with onSubmit / URL action)', async () => {
    const ok = [
      "import { useState, useEffect, lazy, Suspense } from 'react';",
      "import { createRoot } from 'react-dom/client';",
      'export const F = () => { const [v] = useState(0); useEffect(() => {}, []);',
      '  return <form action="/search" onSubmit={(e) => e.preventDefault()}>{v}</form>; };',
      'export const x = [lazy, Suspense, createRoot];',
      'const Box = (p: { action: { label: string } }) => <i>{p.action.label}</i>;',
      "export const G = () => <Box action={{ label: 'retry' }} />;",
    ].join('\n');
    assert.deepEqual(await rules(ok), []);
  });
});
