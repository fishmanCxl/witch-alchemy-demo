import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  chapterTenDifficultyProfile,
  chapterTenDifficultyTarget,
  chapterTenGenerationSpec,
  chapterTenGeneratorSeed,
  chapterTenMode,
  chapterTenParentLevel,
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
    [271, 272, 273, 274, 298, 300].map(chapterTenParentLevel),
    [null, 265, 266, 267, 270, 270],
  );
  assert.deepEqual(
    [295, 296, 297].map((number) => chapterTenGenerationSpec(number).minimumOptimalMoves),
    [41, 40, 40],
  );
  assert.deepEqual(
    [295, 296, 297].map((number) => chapterTenGenerationSpec(number).minimumExploredStates),
    [80_000, 80_000, 110_000],
  );
  assert.deepEqual(
    [295, 296, 297].map((number) => chapterTenGenerationSpec(number).minimumMisleadingBranchRatio),
    [1 / 11, 4 / 11, 2 / 11],
  );
  assert.equal(chapterTenGeneratorSeed(271), (0x270F_0000 + Math.imul(271, 104_729)) >>> 0);
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
  assert.throws(() => searchChapterTenLevel(272, 1), /exceeded level budget/);
});
