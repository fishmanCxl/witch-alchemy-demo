import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateLevelConfig, type LevelConfig } from '../assets/scripts/core/level-config.ts';
import { isCompleteBottle } from '../assets/scripts/core/water-sort.ts';
import {
  generateCandidate,
  generatedOutputMatches,
  type GenerationSpec,
} from '../tools/level-generator.ts';
import { applyMoveAndVanish } from '../tools/level-solver.ts';

const SPEC: GenerationSpec = {
  number: 4,
  colorCount: 4,
  emptyBottleCount: 2,
  reverseMoves: 9,
  targetDifficulty: 0.5,
  minimumOptimalMoves: 0,
  maximumOptimalMoves: 100,
  minimumSegments: 0,
  minimumExploredStates: 0,
  minimumOpeningMoves: 0,
  maximumOpeningMoves: 100,
  minimumMisleadingBranchRatio: 0,
  maxAttempts: 20,
};

test('candidate generation is identical for one seed and diverse across seeds', () => {
  const first = generateCandidate(SPEC, 41);
  const repeated = generateCandidate(SPEC, 41);
  const different = generateCandidate(SPEC, 42);

  assert.deepEqual(repeated, first);
  assert.notDeepEqual(different.initialState, first.initialState);
});

test('accepted candidates are ranked by distance to target difficulty', () => {
  const candidate = generateCandidate({
    ...SPEC,
    targetDifficulty: 1,
    maxAttempts: 50,
  }, 41);

  assert.equal(candidate.attempt, 41);
  assert.equal(candidate.metrics.difficultyRating, 0.356);
  assert.equal(candidate.metrics.difficultyScore, 3_560);
});

test('recorded inverse moves replay through completion-and-vanish semantics', () => {
  const candidate = generateCandidate(SPEC, 9);
  const solved = candidate.inverseMoves.reduce(applyMoveAndVanish, candidate.initialState);

  assert.equal(solved.bottles.filter((bottle) => bottle.status === 'vanished').length, 4);
  assert.equal(candidate.inverseMoves.length, SPEC.reverseMoves);
  assert.equal(candidate.metrics.optimalMoves <= candidate.inverseMoves.length, true);
});

test('generated candidates preserve color totals, reserved slot, and valid openings', () => {
  const candidate = generateCandidate(SPEC, 99);
  const config: LevelConfig = {
    id: 'level-004',
    number: 4,
    configVersion: 'test-generated-v1',
    presentationSeed: 99,
    capacity: 4,
    slotCount: 15,
    rewardSlotIndex: 14,
    completionRule: { type: 'all-colors', targetCount: SPEC.colorCount },
    metrics: candidate.metrics,
    initialState: candidate.initialState,
  };

  assert.deepEqual(validateLevelConfig(config), []);
  assert.equal(config.initialState.bottles[14].status, 'reserved');
  assert.equal(config.initialState.bottles.some(isCompleteBottle), false);
  assert.equal(config.metrics.colorCount, SPEC.colorCount);
  assert.ok(config.metrics.openingMoves >= 2);
});

test('candidate generation fails after maxAttempts with a stable diagnostic', () => {
  assert.throws(
    () => generateCandidate({
      ...SPEC,
      minimumOptimalMoves: 1_000_000,
      maxAttempts: 2,
    }, 7),
    new Error('Unable to generate level 4 from seed 7 after 2 attempts'),
  );
});

test('candidate generation enforces every metric window independently', () => {
  const impossibleSpecs: readonly Partial<GenerationSpec>[] = [
    { minimumOptimalMoves: 1_000_000 },
    { maximumOptimalMoves: 0 },
    { minimumSegments: 1_000_000 },
    { minimumExploredStates: 1_000_000 },
    { minimumOpeningMoves: 1_000_000 },
    { maximumOpeningMoves: 0 },
    { minimumMisleadingBranchRatio: 1.1 },
  ];

  for (const impossible of impossibleSpecs) {
    assert.throws(
      () => generateCandidate({ ...SPEC, ...impossible, maxAttempts: 1 }, 41),
      /Unable to generate level 4/,
    );
  }
});

test('generated output comparison normalizes line endings without hiding content changes', () => {
  assert.equal(generatedOutputMatches('alpha\r\nbeta\r\n', 'alpha\nbeta\n'), true);
  assert.equal(generatedOutputMatches('alpha\r\nwrong\r\n', 'alpha\nbeta\n'), false);
});

test('chapter two difficulty follows the approved anchors and interpolation', async () => {
  const generator = await import('../tools/generate-chapter-two.ts').catch(() => ({}));
  assert.equal(typeof generator.chapterTwoDifficultyTarget, 'function');
  const target = generator.chapterTwoDifficultyTarget as (level: number) => number;

  assert.deepEqual(
    [31, 32, 33, 35, 40, 50, 55, 57, 58, 60].map(target),
    [0.88, 0.96, 0.97, 0.99, 1.01, 1.04, 1.05, 1.05, 1.027, 0.98],
  );
  assert.throws(() => target(30), RangeError);
  assert.throws(() => target(61), RangeError);
});

test('chapter two generation gates start hard and rise at the peak', async () => {
  const generator = await import('../tools/generate-chapter-two.ts').catch(() => ({}));
  assert.equal(typeof generator.chapterTwoGenerationSpec, 'function');
  assert.equal(typeof generator.chapterTwoGeneratorSeed, 'function');

  const opening = generator.chapterTwoGenerationSpec(31);
  assert.deepEqual(opening, {
    number: 31,
    colorCount: 8,
    emptyBottleCount: 2,
    reverseMoves: 24,
    targetDifficulty: 0.88,
    minimumOptimalMoves: 22,
    maximumOptimalMoves: 36,
    minimumSegments: 26,
    minimumExploredStates: 2_000,
    minimumOpeningMoves: 2,
    maximumOpeningMoves: 18,
    minimumMisleadingBranchRatio: 0.25,
    maxAttempts: 25_000,
  });

  const peak = generator.chapterTwoGenerationSpec(55);
  assert.equal(peak.colorCount, 9);
  assert.equal(peak.targetDifficulty, 1);
  assert.equal(peak.minimumOptimalMoves, 24);
  assert.equal(peak.maximumOptimalMoves, 38);
  assert.equal(peak.minimumSegments, 28);
  assert.ok(peak.minimumExploredStates >= 3_800);
  assert.ok(peak.minimumMisleadingBranchRatio >= 0.29);
  assert.equal(generator.chapterTwoGeneratorSeed(31), (0x2608_0000 + Math.imul(31, 104_729)) >>> 0);
  assert.throws(() => generator.chapterTwoGenerationSpec(30), RangeError);
  assert.throws(() => generator.chapterTwoGeneratorSeed(61), RangeError);
});

test('chapter one generation curve and range table match the published design', async () => {
  const {
    chapterOneDifficultyTarget,
    generationSpecForLevel,
  } = await import('../tools/generate-levels.ts');
  const targets = [
    0.05, 0.6, 0.68, 0.73, 0.78, 0.8, 0.82, 0.84, 0.86, 0.88,
    0.889, 0.898, 0.907, 0.916, 0.925, 0.934, 0.943, 0.952, 0.961, 0.97,
    0.976, 0.982, 0.988, 0.994, 1, 1, 1, 0.967, 0.933, 0.9,
  ];

  assert.deepEqual(
    Array.from({ length: 30 }, (_, index) => chapterOneDifficultyTarget(index + 1)),
    targets,
  );
  assert.equal(generationSpecForLevel(3).reverseMoves, 16);
  assert.equal(generationSpecForLevel(4).reverseMoves, 16);
  assert.equal(generationSpecForLevel(6).reverseMoves, 16);
  assert.equal(generationSpecForLevel(7).reverseMoves, 19);
  assert.equal(generationSpecForLevel(8).reverseMoves, 19);
  assert.equal(generationSpecForLevel(9).reverseMoves, 19);
  assert.equal(generationSpecForLevel(13).reverseMoves, 22);
  assert.equal(generationSpecForLevel(15).reverseMoves, 22);
  assert.equal(generationSpecForLevel(16).reverseMoves, 25);
  assert.equal(generationSpecForLevel(19).reverseMoves, 25);
  assert.equal(generationSpecForLevel(22).reverseMoves, 27);
  assert.equal(generationSpecForLevel(26).maximumOpeningMoves, 20);
  assert.equal(generationSpecForLevel(27).maximumOpeningMoves, 24);
  assert.deepEqual(generationSpecForLevel(2), {
    number: 2,
    colorCount: 3,
    emptyBottleCount: 2,
    reverseMoves: 16,
    targetDifficulty: 0.6,
    minimumOptimalMoves: 7,
    maximumOptimalMoves: 10,
    minimumSegments: 8,
    minimumExploredStates: 20,
    minimumOpeningMoves: 2,
    maximumOpeningMoves: 12,
    minimumMisleadingBranchRatio: 0.1,
    maxAttempts: 5_000,
  });
  assert.deepEqual(generationSpecForLevel(5), {
    number: 5,
    colorCount: 4,
    emptyBottleCount: 2,
    reverseMoves: 16,
    targetDifficulty: 0.78,
    minimumOptimalMoves: 10,
    maximumOptimalMoves: 16,
    minimumSegments: 12,
    minimumExploredStates: 100,
    minimumOpeningMoves: 2,
    maximumOpeningMoves: 14,
    minimumMisleadingBranchRatio: 0.15,
    maxAttempts: 5_000,
  });
  assert.deepEqual(generationSpecForLevel(10), {
    number: 10,
    colorCount: 5,
    emptyBottleCount: 2,
    reverseMoves: 19,
    targetDifficulty: 0.88,
    minimumOptimalMoves: 14,
    maximumOptimalMoves: 24,
    minimumSegments: 18,
    minimumExploredStates: 500,
    minimumOpeningMoves: 2,
    maximumOpeningMoves: 16,
    minimumMisleadingBranchRatio: 0.2,
    maxAttempts: 8_000,
  });
  assert.deepEqual(generationSpecForLevel(20), {
    number: 20,
    colorCount: 7,
    emptyBottleCount: 2,
    reverseMoves: 25,
    targetDifficulty: 0.97,
    minimumOptimalMoves: 18,
    maximumOptimalMoves: 30,
    minimumSegments: 25,
    minimumExploredStates: 2_000,
    minimumOpeningMoves: 2,
    maximumOpeningMoves: 18,
    minimumMisleadingBranchRatio: 0.25,
    maxAttempts: 12_000,
  });
  assert.deepEqual(generationSpecForLevel(25), {
    number: 25,
    colorCount: 9,
    emptyBottleCount: 2,
    reverseMoves: 28,
    targetDifficulty: 1,
    minimumOptimalMoves: 22,
    maximumOptimalMoves: 40,
    minimumSegments: 32,
    minimumExploredStates: 5_000,
    minimumOpeningMoves: 2,
    maximumOpeningMoves: 18,
    minimumMisleadingBranchRatio: 0.3,
    maxAttempts: 20_000,
  });
  assert.deepEqual(generationSpecForLevel(28), {
    number: 28,
    colorCount: 10,
    emptyBottleCount: 2,
    reverseMoves: 27,
    targetDifficulty: 0.967,
    minimumOptimalMoves: 16,
    maximumOptimalMoves: 30,
    minimumSegments: 24,
    minimumExploredStates: 1_000,
    minimumOpeningMoves: 2,
    maximumOpeningMoves: 20,
    minimumMisleadingBranchRatio: 0.2,
    maxAttempts: 10_000,
  });
});

test('generation report records the exact target peak and every published metric envelope', () => {
  const report = JSON.parse(readFileSync(
    new URL('../assets/scripts/core/level-generation-report.json', import.meta.url),
    'utf8',
  ));
  const targets = [
    0.05, 0.6, 0.68, 0.73, 0.78, 0.8, 0.82, 0.84, 0.86, 0.88,
    0.889, 0.898, 0.907, 0.916, 0.925, 0.934, 0.943, 0.952, 0.961, 0.97,
    0.976, 0.982, 0.988, 0.994, 1, 1, 1, 0.967, 0.933, 0.9,
  ];
  const colors = [
    1, 3, 3, 4, 4, 4, 5, 5, 5, 5,
    6, 8, 6, 6, 6, 7, 7, 7, 7, 7,
    8, 8, 9, 9, 9, 10, 12, 10, 9, 8,
  ];
  const ranges = [
    [2, 4, 7, 10, 8, 20, 2, 12, 0.1],
    [5, 9, 10, 16, 12, 100, 2, 14, 0.15],
    [10, 19, 14, 24, 18, 500, 2, 16, 0.2],
    [20, 24, 18, 30, 26, 2_000, 2, 18, 0.25],
    [25, 27, 22, 40, 34, 5_000, 2, 18, 0.3],
    [28, 30, 16, 30, 24, 1_000, 2, 18, 0.2],
  ];

  assert.equal(report.schemaVersion, 2);
  assert.equal(report.configVersion, 'chapter-1.2026-08-25.1');
  assert.equal(report.levels.length, 30);
  const reportedTargets = report.levels.map((level: { targetDifficulty: number }) => (
    level.targetDifficulty
  ));
  assert.deepEqual(reportedTargets, targets);
  assert.deepEqual(reportedTargets.slice(24, 27), [1, 1, 1]);
  assert.deepEqual(reportedTargets.slice(27, 30), [0.967, 0.933, 0.9]);
  assert.deepEqual(report.levels.map((level: { metrics: { colorCount: number } }) => (
    level.metrics.colorCount
  )), colors);
  assert.equal(report.levels[0].source, 'tutorial');
  assert.equal(report.levels[11].source, 'legacy');
  assert.equal(report.levels[11].compatibilityExemption, 'legacy-level-12');

  for (const level of report.levels) {
    if (level.id === 'level-001') {
      assert.equal(level.compatibilityExemption, null);
      continue;
    }
    if (level.id === 'level-012') continue;
    const number = Number(level.id.slice(-3));
    const range = ranges.find(([start, end]) => number >= start && number <= end);
    assert.ok(range, level.id);
    const [, , minMoves, maxMoves, minSegments, minStates, minOpen, maxOpen, minRatio] = range;
    const expectedMinSegments = number === 20 ? 25 : number === 25 ? 32 : minSegments;
    const expectedMaxOpen = number === 27 ? 24 : number === 26 || number === 28 ? 20 : maxOpen;
    assert.equal(level.source, 'generated');
    assert.equal(level.compatibilityExemption, null);
    assert.ok(level.metrics.optimalMoves >= minMoves, level.id);
    assert.ok(level.metrics.optimalMoves <= maxMoves, level.id);
    assert.ok(level.metrics.segmentCount >= expectedMinSegments, level.id);
    assert.ok(level.metrics.exploredStates >= minStates, level.id);
    assert.ok(level.metrics.openingMoves >= minOpen, level.id);
    assert.ok(level.metrics.openingMoves <= expectedMaxOpen, level.id);
    assert.ok(level.metrics.misleadingBranchRatio >= minRatio, level.id);
  }

  const easingRatings = report.levels.slice(27, 30).map((level: {
    metrics: { difficultyRating: number };
  }) => level.metrics.difficultyRating);
  assert.ok(easingRatings[0] > easingRatings[1]);
  assert.ok(easingRatings[1] > easingRatings[2]);
});

test('reverse-move plans distinguish formula values from evidence-backed overrides', async () => {
  const { reverseMovesPlanForLevel } = await import('../tools/generate-levels.ts');
  assert.equal(typeof reverseMovesPlanForLevel, 'function');
  const overrideLevels = [7, 8, 9, 10, 16, 17, 18, 19, 22];
  assert.deepEqual(
    overrideLevels.map((number) => {
      const plan = reverseMovesPlanForLevel(number);
      return [number, plan.formula, plan.selected, typeof plan.overrideReason];
    }),
    [
      [7, 24, 19, 'string'],
      [8, 24, 19, 'string'],
      [9, 25, 19, 'string'],
      [10, 25, 19, 'string'],
      [16, 27, 25, 'string'],
      [17, 27, 25, 'string'],
      [18, 27, 25, 'string'],
      [19, 27, 25, 'string'],
      [22, 28, 27, 'string'],
    ],
  );
  assert.deepEqual(reverseMovesPlanForLevel(11), {
    formula: 26,
    selected: 26,
    overrideReason: null,
  });
});

test('published generation diagnostics report only windows missed by an analyzed candidate', async () => {
  const { generateCandidateWithDiagnostics } = await import('../tools/generate-levels.ts');
  assert.equal(typeof generateCandidateWithDiagnostics, 'function');

  assert.throws(
    () => generateCandidateWithDiagnostics({
      ...SPEC,
      minimumOptimalMoves: 1_000_000,
      maxAttempts: 2,
    }, 9),
    new Error(
      'Level 4, seed 9, attempts 2: analyzed candidate missed optimalMoves>=1000000; '
      + 'nearest metrics optimalMoves=7, segmentCount=10, exploredStates=18, openingMoves=8, '
      + 'misleadingBranchRatio=0.5',
    ),
  );
});

test('published generation diagnostics identify construction exhaustion without inventing metrics', async () => {
  const { generateCandidateWithDiagnostics } = await import('../tools/generate-levels.ts');
  assert.equal(typeof generateCandidateWithDiagnostics, 'function');

  assert.throws(
    () => generateCandidateWithDiagnostics({
      ...SPEC,
      reverseMoves: 1_000,
      maxAttempts: 1,
    }, 9),
    new Error(
      'Level 4, seed 9, attempts 1: reverse-walk/candidate construction exhausted before an '
      + 'analyzable candidate; nearest metrics unavailable',
    ),
  );
});
