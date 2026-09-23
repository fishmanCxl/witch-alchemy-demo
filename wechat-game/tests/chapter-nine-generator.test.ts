import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chapterNineDifficultyProfile,
  chapterNineDifficultyTarget,
  chapterNineGenerationSpec,
  chapterNineGeneratorSeed,
  chapterNineMode,
  chapterNineParentLevel,
  searchChapterNineLevel,
} from '../tools/generate-chapter-nine.ts';

test('chapter nine uses approved anchors and piecewise interpolation', () => {
  assert.deepEqual(
    [241, 242, 245, 250, 260, 265, 266, 267, 270].map(chapterNineDifficultyTarget),
    [1.37, 1.45, 1.48, 1.50, 1.53, 1.54, 1.54, 1.54, 1.47],
  );
  assert.equal(chapterNineDifficultyTarget(243), 1.46);
  assert.equal(chapterNineDifficultyTarget(268), 1.517);
  assert.equal(chapterNineDifficultyTarget(269), 1.493);
  assert.throws(() => chapterNineDifficultyTarget(240), RangeError);
  assert.throws(() => chapterNineDifficultyTarget(271), RangeError);
});

test('chapter nine hard gates never substitute colors or impossible segments', () => {
  for (let number = 241; number <= 270; number += 1) {
    const spec = chapterNineGenerationSpec(number);
    assert.equal(spec.colorCount, 11, String(number));
    assert.equal(spec.emptyBottleCount, 2, String(number));
    assert.ok(spec.minimumSegments <= 44, String(number));
    assert.equal(spec.minimumOpeningMoves, 22, String(number));
    assert.equal(spec.maximumOpeningMoves, 22, String(number));
    assert.equal(spec.maxAttempts, 600, String(number));
  }
  assert.deepEqual(
    [241, 242, 243, 244, 265, 266, 267, 268, 269, 270].map(chapterNineDifficultyProfile),
    ['baseline', 'deep', 'deceptive', 'tangled', 'deep', 'deceptive', 'tangled', 'baseline', 'baseline', 'baseline'],
  );
  assert.deepEqual(
    [241, 242, 243, 244, 268, 269, 270].map(chapterNineParentLevel),
    [null, 235, 236, 237, 240, 240, 240],
  );
  assert.equal(chapterNineGenerationSpec(242).minimumMisleadingBranchRatio, 2 / 11);
  assert.equal(chapterNineGenerationSpec(250).minimumOptimalMoves, 38);
  assert.equal(chapterNineGenerationSpec(250).minimumExploredStates, 90_294);
  assert.equal(chapterNineGenerationSpec(255).minimumMisleadingBranchRatio, 2 / 11);
  assert.equal(chapterNineGenerationSpec(264).minimumMisleadingBranchRatio, 2 / 11);
  assert.equal(chapterNineGenerationSpec(257).minimumOptimalMoves, 39);
  assert.equal(chapterNineGenerationSpec(265).minimumOptimalMoves, 40);
  assert.equal(chapterNineGenerationSpec(265).minimumMisleadingBranchRatio, 1 / 11);
  assert.equal(chapterNineGenerationSpec(266).minimumMisleadingBranchRatio, 4 / 11);
  assert.equal(chapterNineGeneratorSeed(266), 4_151_867_415);
  assert.equal(chapterNineGenerationSpec(267).minimumExploredStates, 100_000);
  assert.equal(chapterNineGenerationSpec(268).minimumOptimalMoves, 38);
  assert.equal(chapterNineGenerationSpec(267).minimumMisleadingBranchRatio, 2 / 11);
  assert.equal(chapterNineGeneratorSeed(267), 96_355_240);
});

test('chapter nine modes are explicit and bounded search validates attempt limits', () => {
  assert.equal(chapterNineMode(['--probe']), 'probe');
  assert.equal(chapterNineMode(['--search']), 'search');
  assert.equal(chapterNineMode(['--check']), 'check');
  assert.equal(chapterNineMode(['--verify-solver']), 'verify-solver');
  assert.throws(() => chapterNineMode([]));
  assert.throws(() => chapterNineMode(['--search', '--check']));
  assert.deepEqual(searchChapterNineLevel(241, 0).counters.attempts, 0);
  assert.throws(() => searchChapterNineLevel(241, 601), RangeError);
});
