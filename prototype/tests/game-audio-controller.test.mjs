import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// This remains a reviewable source-wiring guard. The real controller, director,
// browser storage, reload, and BGM path are exercised by home-settings-runtime.spec.ts.
test('master sound source keeps the atomic state, persistence, and director wiring adjacent', () => {
  const source = readFileSync(new URL('../src/audio/useGameAudio.ts', import.meta.url), 'utf8');
  const setterBody = source.match(
    /const setSoundEnabled = useCallback\(\(enabled: boolean\) => \{([\s\S]*?)\n  \}, \[\]\);/,
  )?.[1] ?? '';

  assert.match(source, /soundEnabled:\s*preferences\.musicEnabled\s*&&\s*preferences\.sfxEnabled/);
  assert.match(source, /setSoundEnabled\(enabled:\s*boolean\)/);
  assert.match(setterBody, /musicEnabled:\s*Boolean\(enabled\)/);
  assert.match(setterBody, /sfxEnabled:\s*Boolean\(enabled\)/);
  assert.match(setterBody, /\n {4}preferencesRef\.current = next;\n {4}setPreferences\(next\);\n {4}persistPreferences\(next\);\n {4}try \{/);
  assert.match(setterBody, /director\.setMusicEnabled\(next\.musicEnabled\)/);
  assert.match(setterBody, /director\.setSfxEnabled\(next\.sfxEnabled\)/);
});
