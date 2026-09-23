import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEMO_LEVEL_CONFIG,
  validateLevelConfig,
  type LevelConfig,
} from '../assets/scripts/core/level-config.ts';
import { isCompleteBottle } from '../assets/scripts/core/water-sort.ts';
import {
  analyzeState,
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
  assert.equal(peak.maximumOpeningMoves, 18);
  assert.equal(generator.chapterTwoGeneratorSeed(31), (0x2608_0000 + Math.imul(31, 104_729)) >>> 0);
  assert.throws(() => generator.chapterTwoGenerationSpec(30), RangeError);
  assert.throws(() => generator.chapterTwoGeneratorSeed(61), RangeError);
});

test('chapter three difficulty follows the approved moonlight anchors and interpolation', async () => {
  const generator = await import('../tools/generate-chapter-three.ts').catch(() => ({}));
  assert.equal(typeof generator.chapterThreeDifficultyTarget, 'function');
  const target = generator.chapterThreeDifficultyTarget as (level: number) => number;

  assert.deepEqual(
    [61, 62, 63, 65, 70, 80, 85, 87, 88, 89, 90].map(target),
    [0.95, 1.03, 1.04, 1.06, 1.08, 1.11, 1.12, 1.12, 1.097, 1.073, 1.05],
  );
  assert.throws(() => target(60), RangeError);
  assert.throws(() => target(91), RangeError);
});

test('chapter three generation gates rise above chapter two without changing board rules', async () => {
  const generator = await import('../tools/generate-chapter-three.ts').catch(() => ({}));
  assert.equal(typeof generator.chapterThreeGenerationSpec, 'function');
  assert.equal(typeof generator.chapterThreeGeneratorSeed, 'function');

  assert.deepEqual(generator.chapterThreeGenerationSpec(61), {
    number: 61,
    colorCount: 8,
    emptyBottleCount: 2,
    reverseMoves: 25,
    targetDifficulty: 0.95,
    minimumOptimalMoves: 23,
    maximumOptimalMoves: 37,
    minimumSegments: 27,
    minimumExploredStates: 2_607,
    minimumOpeningMoves: 2,
    maximumOpeningMoves: 17,
    minimumMisleadingBranchRatio: 0.2691780821917808,
    maxAttempts: 25_000,
  });

  const peak = generator.chapterThreeGenerationSpec(85);
  assert.equal(peak.colorCount, 9);
  assert.equal(peak.reverseMoves, 27);
  assert.equal(peak.targetDifficulty, 1);
  assert.equal(peak.minimumOptimalMoves, 25);
  assert.equal(peak.maximumOptimalMoves, 39);
  assert.equal(peak.minimumSegments, 29);
  assert.equal(peak.minimumExploredStates, 4_961);
  assert.equal(peak.minimumOpeningMoves, 2);
  assert.equal(peak.maximumOpeningMoves, 18);
  assert.equal(peak.minimumMisleadingBranchRatio, 0.31575342465753425);
  assert.equal(peak.maxAttempts, 25_000);
  assert.equal(generator.chapterThreeGeneratorSeed(61), (0x2609_0000 + Math.imul(61, 104_729)) >>> 0);
  assert.throws(() => generator.chapterThreeGenerationSpec(60), RangeError);
  assert.throws(() => generator.chapterThreeGeneratorSeed(91), RangeError);
});

test('chapter five difficulty follows the approved frost anchors and interpolation', async () => {
  const generator = await import('../tools/generate-chapter-five.ts').catch(() => ({}));
  assert.equal(typeof generator.chapterFiveDifficultyTarget, 'function');
  const target = generator.chapterFiveDifficultyTarget as (level: number) => number;

  assert.deepEqual(
    [121, 122, 123, 124, 125, 130, 140, 145, 147, 148, 149, 150].map(target),
    [1.09, 1.17, 1.18, 1.19, 1.2, 1.22, 1.25, 1.26, 1.26, 1.237, 1.213, 1.19],
  );
  assert.throws(() => target(120), RangeError);
  assert.throws(() => target(151), RangeError);
});

test('candidate generation rejects specs that cannot fit the fourteen ordinary slots', () => {
  assert.throws(
    () => generateCandidate({ ...SPEC, colorCount: 13, emptyBottleCount: 2 }, 41),
    /colorCount/,
  );
  assert.throws(
    () => generateCandidate({ ...SPEC, colorCount: 12, emptyBottleCount: 3 }, 41),
    /14 ordinary slots/,
  );
});

test('chapter five uses ten colors and the approved optimal-move gates', async () => {
  const generator = await import('../tools/generate-chapter-five.ts').catch(() => ({}));
  assert.equal(typeof generator.chapterFiveGenerationSpec, 'function');
  assert.equal(typeof generator.chapterFiveGeneratorSeed, 'function');

  const expectedMinimumMoves = new Map([
    [121, 26], [122, 26], [123, 27], [124, 27],
    [125, 28], [130, 29], [135, 30],
    [140, 30], [142, 31], [144, 32],
    [145, 32], [146, 34], [147, 34],
    [148, 31], [149, 30], [150, 29],
  ]);
  for (const [number, minimumOptimalMoves] of expectedMinimumMoves) {
    const spec = generator.chapterFiveGenerationSpec(number);
    assert.equal(spec.colorCount, 10, String(number));
    assert.equal(spec.emptyBottleCount, 2, String(number));
    assert.equal(spec.minimumOptimalMoves, minimumOptimalMoves, String(number));
    assert.equal(spec.maximumOpeningMoves, 20, String(number));
    assert.ok(spec.minimumMisleadingBranchRatio >= 0.3, String(number));
  }
  for (const number of [145, 146, 147]) {
    assert.ok(generator.chapterFiveGenerationSpec(number).minimumExploredStates >= 15_000);
  }
  assert.equal(
    generator.chapterFiveGeneratorSeed(121),
    (0x260B_0000 + Math.imul(121, 104_729)) >>> 0,
  );
  assert.throws(() => generator.chapterFiveGenerationSpec(120), RangeError);
  assert.throws(() => generator.chapterFiveGeneratorSeed(151), RangeError);
});

test('chapter six difficulty follows the approved wind-spirit anchors and interpolation', async () => {
  const generator = await import('../tools/generate-chapter-six.ts').catch(() => ({}));
  assert.equal(typeof generator.chapterSixDifficultyTarget, 'function');
  const target = generator.chapterSixDifficultyTarget as (level: number) => number;

  assert.deepEqual(
    Array.from({ length: 30 }, (_, index) => target(index + 151)),
    [
      1.16, 1.24, 1.25, 1.26, 1.27,
      1.274, 1.278, 1.282, 1.286, 1.29,
      1.293, 1.296, 1.299, 1.302, 1.305,
      1.308, 1.311, 1.314, 1.317, 1.32,
      1.322, 1.324, 1.326, 1.328, 1.33,
      1.33, 1.33, 1.307, 1.283, 1.26,
    ],
  );
  assert.throws(() => target(150), RangeError);
  assert.throws(() => target(181), RangeError);
});

test('chapter six uses eleven colors and hard gates beyond the capped target rating', async () => {
  const generator = await import('../tools/generate-chapter-six.ts').catch(() => ({}));
  assert.equal(typeof generator.chapterSixGenerationSpec, 'function');
  assert.equal(typeof generator.chapterSixGeneratorSeed, 'function');

  const expected = new Map([
    [151, [31, 38, 15_000]],
    [152, [32, 39, 18_000]],
    [153, [33, 39, 20_000]],
    [155, [34, 40, 24_000]],
    [160, [35, 40, 30_000]],
    [165, [36, 41, 40_000]],
    [170, [37, 41, 50_000]],
    [175, [38, 42, 65_000]],
    [177, [38, 42, 65_000]],
    [178, [37, 41, 34_000]],
    [179, [35, 41, 29_000]],
    [180, [34, 40, 24_000]],
  ]);
  for (const [number, [minimumOptimalMoves, minimumSegments, minimumExploredStates]] of expected) {
    const spec = generator.chapterSixGenerationSpec(number);
    assert.equal(spec.colorCount, 11, String(number));
    assert.equal(spec.emptyBottleCount, 2, String(number));
    assert.equal(spec.targetDifficulty, 1, String(number));
    assert.equal(spec.minimumOptimalMoves, minimumOptimalMoves, String(number));
    assert.equal(spec.maximumOptimalMoves, minimumOptimalMoves + 5, String(number));
    assert.equal(spec.minimumSegments, minimumSegments, String(number));
    assert.equal(spec.minimumExploredStates, minimumExploredStates, String(number));
    assert.equal(spec.minimumOpeningMoves, 22, String(number));
    assert.equal(spec.maximumOpeningMoves, 22, String(number));
  }
  assert.equal(generator.chapterSixGenerationSpec(151).minimumMisleadingBranchRatio, 4 / 11);
  assert.equal(generator.chapterSixGenerationSpec(155).minimumMisleadingBranchRatio, 5 / 11);
  assert.equal(generator.chapterSixGenerationSpec(178).minimumMisleadingBranchRatio, 4 / 11);
  assert.equal(generator.chapterSixGenerationSpec(179).minimumMisleadingBranchRatio, 4 / 11);
  assert.equal(
    generator.chapterSixGeneratorSeed(151),
    (0x260C_0000 + Math.imul(151, 104_729)) >>> 0,
  );
  assert.throws(() => generator.chapterSixGenerationSpec(150), RangeError);
  assert.throws(() => generator.chapterSixGeneratorSeed(181), RangeError);
});

test('chapter four difficulty follows the approved elemental anchors and interpolation', async () => {
  const generator = await import('../tools/generate-chapter-four.ts').catch(() => ({}));
  assert.equal(typeof generator.chapterFourDifficultyTarget, 'function');
  const target = generator.chapterFourDifficultyTarget as (level: number) => number;

  assert.deepEqual(
    [91, 92, 93, 95, 100, 110, 115, 117, 118, 119, 120].map(target),
    [1.02, 1.1, 1.11, 1.13, 1.15, 1.18, 1.19, 1.19, 1.167, 1.143, 1.12],
  );
  assert.throws(() => target(90), RangeError);
  assert.throws(() => target(121), RangeError);
});

test('chapter four generation gates rise above chapter three without changing board rules', async () => {
  const generator = await import('../tools/generate-chapter-four.ts').catch(() => ({}));
  assert.equal(typeof generator.chapterFourGenerationSpec, 'function');
  assert.equal(typeof generator.chapterFourGeneratorSeed, 'function');

  assert.deepEqual(generator.chapterFourGenerationSpec(91), {
    number: 91,
    colorCount: 9,
    emptyBottleCount: 2,
    reverseMoves: 26,
    targetDifficulty: 1,
    minimumOptimalMoves: 24,
    maximumOptimalMoves: 38,
    minimumSegments: 28,
    minimumExploredStates: 3_398,
    minimumOpeningMoves: 2,
    maximumOpeningMoves: 18,
    minimumMisleadingBranchRatio: 0.28835616438356165,
    maxAttempts: 25_000,
  });

  const peak = generator.chapterFourGenerationSpec(115);
  assert.equal(peak.colorCount, 10);
  assert.equal(peak.reverseMoves, 28);
  assert.equal(peak.targetDifficulty, 1);
  assert.equal(peak.minimumOptimalMoves, 26);
  assert.equal(peak.maximumOptimalMoves, 40);
  assert.equal(peak.minimumSegments, 30);
  assert.equal(peak.minimumExploredStates, 6_466);
  assert.equal(peak.minimumOpeningMoves, 2);
  assert.equal(peak.maximumOpeningMoves, 20);
  assert.equal(peak.minimumMisleadingBranchRatio, 0.33493150684931505);
  assert.equal(peak.maxAttempts, 25_000);
  assert.equal(generator.chapterFourGeneratorSeed(91), (0x260A_0000 + Math.imul(91, 104_729)) >>> 0);
  assert.throws(() => generator.chapterFourGenerationSpec(90), RangeError);
  assert.throws(() => generator.chapterFourGeneratorSeed(121), RangeError);
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

test('chapter two report records thirty generated levels without exemptions', () => {
  const reportUrl = new URL(
    '../assets/scripts/core/level-generation-report.chapter-02.json',
    import.meta.url,
  );
  assert.equal(existsSync(reportUrl), true);
  const report = JSON.parse(readFileSync(reportUrl, 'utf8'));

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.chapterId, 2);
  assert.equal(report.levels.length, 30);
  assert.deepEqual(
    report.levels.map((entry: { id: string }) => entry.id),
    Array.from({ length: 30 }, (_, index) => `level-${String(index + 31).padStart(3, '0')}`),
  );
  for (const entry of report.levels) {
    assert.equal(entry.source, 'generated');
    assert.equal(entry.compatibilityExemption, null);
  }
});

test('chapter three report records thirty solved levels and every approved coefficient', async () => {
  const reportUrl = new URL(
    '../assets/scripts/core/level-generation-report.chapter-03.json',
    import.meta.url,
  );
  assert.equal(existsSync(reportUrl), true);
  const report = JSON.parse(readFileSync(reportUrl, 'utf8'));
  const { chapterThreeDifficultyTarget, chapterThreeGenerationSpec } = await import(
    '../tools/generate-chapter-three.ts'
  );

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.chapterId, 3);
  assert.equal(report.configVersion, 'chapter-3.2026-09-05.1');
  assert.equal(report.levels.length, 30);
  assert.deepEqual(
    report.levels.map((entry: { id: string }) => entry.id),
    Array.from({ length: 30 }, (_, index) => `level-${String(index + 61).padStart(3, '0')}`),
  );
  for (const entry of report.levels) {
    const number = Number(entry.id.slice(-3));
    const spec = chapterThreeGenerationSpec(number);
    assert.equal(entry.source, 'generated');
    assert.equal(entry.compatibilityExemption, null);
    assert.equal(entry.targetCoefficient, chapterThreeDifficultyTarget(number));
    assert.ok(entry.metrics.optimalMoves >= spec.minimumOptimalMoves, entry.id);
    assert.ok(entry.metrics.optimalMoves <= spec.maximumOptimalMoves, entry.id);
    assert.ok(entry.metrics.segmentCount >= spec.minimumSegments, entry.id);
    assert.ok(entry.metrics.exploredStates >= spec.minimumExploredStates, entry.id);
    assert.ok(entry.metrics.openingMoves >= spec.minimumOpeningMoves, entry.id);
    assert.ok(entry.metrics.openingMoves <= spec.maximumOpeningMoves, entry.id);
    assert.ok(entry.metrics.misleadingBranchRatio >= spec.minimumMisleadingBranchRatio, entry.id);
  }
});

test('chapter four report records thirty solved levels and every approved coefficient', async () => {
  const reportUrl = new URL(
    '../assets/scripts/core/level-generation-report.chapter-04.json',
    import.meta.url,
  );
  assert.equal(existsSync(reportUrl), true);
  const report = JSON.parse(readFileSync(reportUrl, 'utf8'));
  const { chapterFourDifficultyTarget, chapterFourGenerationSpec } = await import(
    '../tools/generate-chapter-four.ts'
  );

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.chapterId, 4);
  assert.equal(report.configVersion, 'chapter-4.2026-09-05.1');
  assert.equal(report.levels.length, 30);
  assert.deepEqual(
    report.levels.map((entry: { id: string }) => entry.id),
    Array.from({ length: 30 }, (_, index) => `level-${String(index + 91).padStart(3, '0')}`),
  );
  for (const entry of report.levels) {
    const number = Number(entry.id.slice(-3));
    const spec = chapterFourGenerationSpec(number);
    assert.equal(entry.source, 'generated');
    assert.equal(entry.compatibilityExemption, null);
    assert.equal(entry.targetCoefficient, chapterFourDifficultyTarget(number));
    assert.ok(entry.metrics.optimalMoves >= spec.minimumOptimalMoves, entry.id);
    assert.ok(entry.metrics.optimalMoves <= spec.maximumOptimalMoves, entry.id);
    assert.ok(entry.metrics.segmentCount >= spec.minimumSegments, entry.id);
    assert.ok(entry.metrics.exploredStates >= spec.minimumExploredStates, entry.id);
    assert.ok(entry.metrics.openingMoves >= spec.minimumOpeningMoves, entry.id);
    assert.ok(entry.metrics.openingMoves <= spec.maximumOpeningMoves, entry.id);
    assert.ok(entry.metrics.misleadingBranchRatio >= spec.minimumMisleadingBranchRatio, entry.id);
  }
});

test('chapter five report records thirty unique solved levels and every approved gate', async () => {
  const reportUrl = new URL(
    '../assets/scripts/core/level-generation-report.chapter-05.json',
    import.meta.url,
  );
  assert.equal(existsSync(reportUrl), true);
  const report = JSON.parse(readFileSync(reportUrl, 'utf8'));
  const { chapterFiveDifficultyTarget, chapterFiveGenerationSpec } = await import(
    '../tools/generate-chapter-five.ts'
  );

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.chapterId, 5);
  assert.equal(report.configVersion, 'chapter-5.2026-09-06.1');
  assert.equal(report.levels.length, 30);
  assert.deepEqual(
    report.levels.map((entry: { id: string }) => entry.id),
    Array.from({ length: 30 }, (_, index) => 'level-' + String(index + 121).padStart(3, '0')),
  );
  assert.equal(new Set(report.levels.map((entry: { boardKey: string }) => entry.boardKey)).size, 30);
  for (const entry of report.levels) {
    const number = Number(entry.id.slice(-3));
    const spec = chapterFiveGenerationSpec(number);
    assert.equal(entry.source, 'generated');
    assert.equal(entry.compatibilityExemption, null);
    assert.equal(entry.targetCoefficient, chapterFiveDifficultyTarget(number));
    assert.equal(entry.metrics.colorCount, 10);
    assert.ok(entry.metrics.optimalMoves >= spec.minimumOptimalMoves, entry.id);
    assert.ok(entry.metrics.optimalMoves <= spec.maximumOptimalMoves, entry.id);
    assert.ok(entry.metrics.segmentCount >= spec.minimumSegments, entry.id);
    assert.ok(entry.metrics.exploredStates >= spec.minimumExploredStates, entry.id);
    assert.ok(entry.metrics.openingMoves >= spec.minimumOpeningMoves, entry.id);
    assert.ok(entry.metrics.openingMoves <= spec.maximumOpeningMoves, entry.id);
    assert.ok(entry.metrics.misleadingBranchRatio >= spec.minimumMisleadingBranchRatio, entry.id);
  }
});

test('chapter six report records thirty unique solved levels and every approved hard gate', async () => {
  const reportUrl = new URL(
    '../assets/scripts/core/level-generation-report.chapter-06.json',
    import.meta.url,
  );
  assert.equal(existsSync(reportUrl), true);
  const report = JSON.parse(readFileSync(reportUrl, 'utf8'));
  const { chapterSixDifficultyTarget, chapterSixGenerationSpec } = await import(
    '../tools/generate-chapter-six.ts'
  );

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.chapterId, 6);
  assert.equal(report.configVersion, 'chapter-6.2026-09-19.1');
  assert.equal(report.levels.length, 30);
  assert.deepEqual(
    report.levels.map((entry: { id: string }) => entry.id),
    Array.from({ length: 30 }, (_, index) => 'level-' + String(index + 151).padStart(3, '0')),
  );
  assert.equal(new Set(report.levels.map((entry: { boardKey: string }) => entry.boardKey)).size, 30);
  for (const entry of report.levels) {
    const number = Number(entry.id.slice(-3));
    const spec = chapterSixGenerationSpec(number);
    assert.equal(entry.source, 'generated');
    assert.equal(entry.compatibilityExemption, null);
    assert.equal(entry.targetCoefficient, chapterSixDifficultyTarget(number));
    assert.equal(entry.targetDifficulty, 1);
    assert.equal(entry.metrics.colorCount, 11);
    assert.ok(entry.metrics.optimalMoves >= spec.minimumOptimalMoves, entry.id);
    assert.ok(entry.metrics.optimalMoves <= spec.maximumOptimalMoves, entry.id);
    assert.ok(entry.metrics.segmentCount >= spec.minimumSegments, entry.id);
    assert.ok(entry.metrics.exploredStates >= spec.minimumExploredStates, entry.id);
    assert.equal(entry.metrics.openingMoves, 22, entry.id);
    assert.ok(entry.metrics.misleadingBranchRatio >= spec.minimumMisleadingBranchRatio, entry.id);
  }
});

test('chapter six check validates locked artifacts without rerunning the exact solver', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      fileURLToPath(new URL('../tools/generate-chapter-six.ts', import.meta.url)),
      '--check',
    ],
    { encoding: 'utf8', timeout: 15_000 },
  );

  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /30 chapter 6 levels match generated output/);
  assert.doesNotMatch(result.stdout, /accepted deterministic shuffle/);
});

test('chapter two generation leaves the frozen first chapter content unchanged across line endings', () => {
  const data = readFileSync(
    new URL('../assets/scripts/core/level-data.generated.ts', import.meta.url),
    'utf8',
  ).replace(/\r\n?/g, '\n');
  assert.equal(
    createHash('sha256').update(data).digest('hex'),
    '149f6502bc162880670ae9079be7b58133466696b88943377ab5fa7b15be684c',
  );
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
