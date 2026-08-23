import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/prototype.css', import.meta.url), 'utf8');

// This source-level contract is intentional: the prototype has no DOM/CSS-animation test runner.
// It catches a visual regression where the bottle flies during, rather than after, its burst.
test('completion burst leads normal departure but reduced motion fades without the lead-in', () => {
  const normalDeparture = css.match(/\.potion-bottle\.is-departing\s*\{([^}]*)\}/s)?.[1] ?? '';
  const reducedMotion = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*)$/)?.[1] ?? '';

  assert.match(normalDeparture, /animation:\s*potion-depart\s+780ms\s+cubic-bezier\(0\.24, 0\.72, 0\.3, 1\)\s+300ms\s+forwards;/);
  assert.match(reducedMotion, /\.potion-bottle\.is-departing,[\s\S]*?animation:\s*completion-fade\s+1ms\s+linear\s+forwards;/);
  assert.doesNotMatch(reducedMotion, /completion-fade\s+1ms\s+linear\s+300ms/);
});
