import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  chapterTenDifficultyProfile,
  chapterTenDifficultyTarget,
  chapterTenGenerationSpec,
  chapterTenGeneratorSeed,
  chapterTenMode,
  chapterTenParentLevel,
  reconstructReportLevel,
  restoreChapterTenCheckpoints,
  searchChapterTenLevel,
} from '../tools/generate-chapter-ten.ts';

test('chapter ten keeps its anchored coefficient curve within levels 271–300', () => {
  assert.deepEqual(
    [271, 272, 275, 280, 290, 295, 296, 297, 300].map(chapterTenDifficultyTarget),
    [1.44, 1.52, 1.55, 1.57, 1.60, 1.61, 1.61, 1.61, 1.54],
  );
  assert.equal(chapterTenDifficultyTarget(276), 1.554);
  assert.equal(chapterTenDifficultyTarget(298), 1.587);
  assert.equal(chapterTenDifficultyTarget(299), 1.563);
  assert.throws(() => chapterTenDifficultyTarget(270), RangeError);
  assert.throws(() => chapterTenDifficultyTarget(301), RangeError);
});

test('chapter ten uses fixed eleven-color geometry and feasible hard gates', () => {
  for (let number = 271; number <= 300; number += 1) {
    const spec = chapterTenGenerationSpec(number);
    assert.equal(spec.colorCount, 11, String(number));
    assert.equal(spec.emptyBottleCount, 2, String(number));
    assert.ok(spec.minimumSegments <= 44, String(number));
    assert.equal(spec.minimumOpeningMoves, 22, String(number));
    assert.equal(spec.maximumOpeningMoves, 22, String(number));
    assert.equal(spec.maxAttempts, 600, String(number));
    assert.equal(spec.targetDifficulty, 1, String(number));
  }
  assert.deepEqual(
    [271, 272, 273, 274, 295, 296, 297, 298, 300].map(chapterTenDifficultyProfile),
    ['baseline', 'deep', 'deceptive', 'tangled', 'deep', 'deceptive', 'tangled', 'baseline', 'baseline'],
  );
  assert.deepEqual(
    [271, 272, 273, 274, 284, 298, 299, 300].map(chapterTenParentLevel),
    [270, 265, 266, 267, 266, 266, 266, 266],
  );
  assert.deepEqual(
    [295, 296, 297].map((number) => chapterTenGenerationSpec(number).minimumOptimalMoves),
    [40, 39, 39],
  );
  assert.deepEqual(
    [285, 288, 291, 294].map((number) => chapterTenGenerationSpec(number).minimumOptimalMoves),
    [39, 39, 39, 39],
  );
  assert.equal(chapterTenGenerationSpec(271).minimumExploredStates, 55_000);
  assert.deepEqual(
    [295, 296, 297].map((number) => chapterTenGenerationSpec(number).minimumExploredStates),
    [75_000, 80_000, 110_000],
  );
  assert.deepEqual(
    [295, 296, 297].map((number) => chapterTenGenerationSpec(number).minimumMisleadingBranchRatio),
    [1 / 11, 4 / 11, 2 / 11],
  );
});

test('level 298 easing board keeps its other hard gates with a 39-step floor', () => {
  const spec = chapterTenGenerationSpec(298);
  assert.equal(spec.minimumOptimalMoves, 39);
  assert.equal(spec.minimumExploredStates, 67_971);
  assert.equal(spec.minimumSegments, 43);
  assert.equal(spec.minimumOpeningMoves, 22);
  assert.equal(spec.minimumMisleadingBranchRatio, 4 / 11);
});

test('level 271 uses the approved deterministic mutation seed', () => {
  assert.equal(chapterTenGeneratorSeed(271), 683_807_095);
  assert.equal(chapterTenGenerationSpec(271).minimumExploredStates, 55_000);
});

test('chapter ten modes are explicit and search attempts are bounded', () => {
  assert.deepEqual(
    ['--probe', '--search', '--check', '--verify-solver'].map((flag) => chapterTenMode([flag])),
    ['probe', 'search', 'check', 'verify-solver'],
  );
  assert.throws(() => chapterTenMode([]));
  assert.throws(() => chapterTenMode(['--search', '--check']));
  assert.equal(searchChapterTenLevel(271, 0).counters.attempts, 0);
  assert.throws(() => searchChapterTenLevel(271, 601), RangeError);
});

test('a candidate completed after the chapter-ten level deadline is not accepted', (t) => {
  let calls = 0;
  t.mock.method(performance, 'now', () => (++calls < 3 ? 0 : 300_001));
  assert.throws(() => searchChapterTenLevel(272, 1), (error: Error) => {
    assert.match(error.message, /exceeded level budget/);
    assert.match(error.message, /"solved":0/);
    assert.match(error.message, /"baseGatePasses":0/);
    return true;
  });
});

test('checkpoint restoration stops when the chapter deadline expires during exact verification', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'chapter-ten-restore-'));
  const checkpoint = join(root, 'chapter-10.checkpoint-271.json');
  t.after(() => {
    unlinkSync(checkpoint);
    rmdirSync(root);
  });
  const report = JSON.parse(readFileSync(new URL('../assets/scripts/core/level-generation-report.chapter-10.json', import.meta.url), 'utf8'));
  writeFileSync(checkpoint, JSON.stringify({
    schemaVersion: 1,
    chapterId: 10,
    configVersion: 'chapter-10.2026-09-24.1',
    level: report.levels[0],
    counters: {
      attempts: report.levels[0].attempt,
      uniqueShapes: 1,
      segmentPasses: 1,
      openingPasses: 1,
      solved: 1,
      baseGatePasses: 1,
      branchGatePasses: 1,
      elapsedMs: 0,
    },
  }));
  let calls = 0;
  t.mock.method(performance, 'now', () => ++calls === 1 ? 0 : 1);
  assert.throws(() => restoreChapterTenCheckpoints(root, 1), /exceeded 60-minute chapter budget/);
});

test('locked chapter-ten report rejects duplicate and tampered entries', () => {
  const report = JSON.parse(readFileSync(new URL('../assets/scripts/core/level-generation-report.chapter-10.json', import.meta.url), 'utf8'));
  assert.equal(report.chapterId, 10);
  assert.equal(report.levels.length, 30);
  const entry = report.levels[0];
  assert.doesNotThrow(() => reconstructReportLevel(271, entry, new Set(), false));
  assert.throws(() => reconstructReportLevel(271, entry, new Set([entry.boardKey]), false));
  for (const change of [
    { source: 'tampered' },
    { compatibilityExemption: 'tampered' },
    { reverseMoves: 999 },
    { attempt: 601 },
    { scoreComponents: { ...entry.scoreComponents, color: -1 } },
  ]) {
    assert.throws(() => reconstructReportLevel(271, { ...entry, ...change }, new Set(), false));
  }
});
