import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as ts from 'typescript';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

// Compile the real TSX component for the Node renderer. Only its CSS import is
// omitted; the hooks and markup under test run unchanged.
const require = createRequire(import.meta.url);
const source = await readFile(
  new URL('../components/game/reveal-motion.tsx', import.meta.url),
  'utf8',
);
const compiled = ts
  .transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  })
  .outputText.replace(/import ['"][^'"]+\.css['"];?/g, '')
  .replace(
    /from ['"](react(?:\/jsx-runtime)?)['"]/g,
    (_, name) =>
      `from ${JSON.stringify(pathToFileURL(require.resolve(name)).href)}`,
  );
const { CountUp } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

await test('count-up hydration starts with identical server markup when the client prefers reduced motion', (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  t.after(() =>
    original
      ? Object.defineProperty(globalThis, 'window', original)
      : delete globalThis.window,
  );
  delete globalThis.window;
  const normal = renderToString(createElement(CountUp, { value: 300 }));
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { matchMedia: () => ({ matches: true }) },
  });
  const reduced = renderToString(createElement(CountUp, { value: 300 }));
  assert.equal(reduced, normal);
  assert.match(normal, /aria-hidden="true">0<\/span>/);
  assert.match(normal, /class="sr-only">300<\/span>/);
});

await test('disabled count-up duration renders the final score on the server', () => {
  const html = renderToString(
    createElement(CountUp, { value: 42, duration: 0 }),
  );
  assert.match(html, /aria-hidden="true">42<\/span>/);
});
