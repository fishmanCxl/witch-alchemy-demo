import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countColorSegments,
  DEMO_LEVEL_CONFIG,
  difficultyRating,
  levelId,
  levelNumber,
  validateLevelConfig,
  type LevelConfig,
} from '../assets/scripts/core/level-config.ts';
import type { BottleState, GameState, PotionColor } from '../assets/scripts/core/types.ts';
import { stateOf } from '../assets/scripts/core/demo-level.ts';

function withConfig(changes: Partial<LevelConfig>): LevelConfig {
  return { ...DEMO_LEVEL_CONFIG, ...changes };
}

function withBottle(
  state: GameState,
  index: number,
  bottle: BottleState,
): GameState {
  return {
    ...state,
    bottles: state.bottles.map((current, bottleIndex) => (
      bottleIndex === index ? bottle : current
    )),
  };
}

test('level ids round-trip only the three-digit positive format', () => {
  assert.equal(levelId(1), 'level-001');
  assert.equal(levelId(15), 'level-015');
  assert.equal(levelNumber('level-001'), 1);
  assert.equal(levelNumber('level-015'), 15);
  assert.equal(levelNumber('level-000'), null);
  assert.equal(levelNumber('level-16'), null);
  assert.equal(levelNumber('LEVEL-015'), null);
  assert.throws(() => levelId(0), RangeError);
  assert.throws(() => levelId(1.5), RangeError);
  assert.throws(() => levelId(1000), RangeError);
});

test('demo level exposes the immutable runtime contract and validates cleanly', () => {
  assert.equal(DEMO_LEVEL_CONFIG.number, 12);
  assert.deepEqual(DEMO_LEVEL_CONFIG.completionRule, {
    type: 'all-colors',
    targetCount: 8,
  });
  assert.equal(DEMO_LEVEL_CONFIG.metrics.difficultyRating >= 0, true);
  assert.equal(DEMO_LEVEL_CONFIG.metrics.difficultyRating <= 1, true);
  assert.equal(DEMO_LEVEL_CONFIG.metrics.misleadingBranchRatio >= 0, true);
  assert.deepEqual(DEMO_LEVEL_CONFIG.metrics, {
    colorCount: 8,
    optimalMoves: 23,
    segmentCount: 30,
    exploredStates: 1_075,
    openingMoves: 20,
    misleadingBranchRatio: 0.7,
    difficultyRating: 0.665,
    difficultyScore: 6_650,
  });
  assert.deepEqual(validateLevelConfig(DEMO_LEVEL_CONFIG), []);
});

test('validator accepts the twelve approved potion colors', () => {
  const colors: PotionColor[] = [
    'rose', 'violet', 'amber', 'cyan', 'mint', 'blue', 'gold', 'lilac',
    'scarlet', 'chartreuse', 'indigo', 'pearl',
  ];
  const bottles: BottleState[] = colors.map((_, index) => ({
    layers: [
      colors[index],
      colors[(index + 1) % colors.length],
      colors[(index + 2) % colors.length],
      colors[(index + 3) % colors.length],
    ],
    status: 'active',
  }));
  bottles.push({ layers: [], status: 'active' });
  bottles.push({ layers: [], status: 'active' });
  bottles.push({ layers: [], status: 'reserved' });

  const config = withConfig({
    id: 'level-004',
    number: 4,
    completionRule: { type: 'all-colors', targetCount: 12 },
    metrics: {
      colorCount: 12,
      optimalMoves: 30,
      segmentCount: 48,
      exploredStates: 10_000,
      openingMoves: 24,
      misleadingBranchRatio: 0.5,
      difficultyRating: 0.6,
      difficultyScore: 6_000,
    },
    initialState: { bottles, rewardBottleUsed: false, moves: 0 },
  });

  assert.equal(new Set(colors).size, 12);
  assert.deepEqual(validateLevelConfig(config), []);
});

test('segment counting and normalized difficulty use the shared literal formula', () => {
  const state = stateOf([
    ['rose', 'rose', 'amber', 'rose'],
    ['amber', 'amber'],
    [],
  ]);
  const rating = difficultyRating({
    colorCount: 4,
    optimalMoves: 20,
    segmentCount: 14,
    exploredStates: 999,
    openingMoves: 8,
    misleadingBranchRatio: 0.5,
  });

  assert.equal(countColorSegments(state), 4);
  assert.equal(rating, 0.66);
});

test('validation rejects non-finite and out-of-range normalized metrics', () => {
  const invalidRatios = [Number.NaN, Number.POSITIVE_INFINITY, -0.01, 1.01];
  for (const misleadingBranchRatio of invalidRatios) {
    assert.match(validateLevelConfig(withConfig({
      metrics: { ...DEMO_LEVEL_CONFIG.metrics, misleadingBranchRatio },
    })).join('\n'), /misleadingBranchRatio must be finite and from 0 to 1/);
  }
  for (const difficultyRating of invalidRatios) {
    assert.match(validateLevelConfig(withConfig({
      metrics: { ...DEMO_LEVEL_CONFIG.metrics, difficultyRating },
    })).join('\n'), /difficultyRating must be finite and from 0 to 1/);
  }
});

test('validation reports identity, fixed-board, and reward-slot violations deterministically', () => {
  const wrongIdentity = withConfig({ id: 'level-011' });
  const shortBoard = withConfig({
    initialState: {
      ...DEMO_LEVEL_CONFIG.initialState,
      bottles: DEMO_LEVEL_CONFIG.initialState.bottles.slice(0, 14),
    },
  });
  const occupiedReward = withConfig({
    initialState: withBottle(DEMO_LEVEL_CONFIG.initialState, 14, {
      layers: ['rose'],
      status: 'active',
    }),
  });

  assert.deepEqual(validateLevelConfig(wrongIdentity), [
    'id must match number as level-012',
  ]);
  assert.match(validateLevelConfig(shortBoard).join('\n'), /15 slots/);
  assert.match(validateLevelConfig(occupiedReward).join('\n'), /reward slot 14 must be empty and reserved/);
});

test('validation rejects over-capacity layers, unknown colors, and wrong color totals', () => {
  const overCapacity = withConfig({
    initialState: withBottle(DEMO_LEVEL_CONFIG.initialState, 0, {
      layers: ['rose', 'rose', 'rose', 'rose', 'rose'],
      status: 'active',
    }),
  });
  const unknownColor = withConfig({
    initialState: withBottle(DEMO_LEVEL_CONFIG.initialState, 0, {
      layers: ['violet', 'amber', 'violet', 'ochre' as PotionColor],
      status: 'active',
    }),
  });
  const wrongTotal = withConfig({
    initialState: withBottle(DEMO_LEVEL_CONFIG.initialState, 0, {
      layers: ['violet', 'amber', 'violet'],
      status: 'active',
    }),
  });

  assert.match(validateLevelConfig(overCapacity).join('\n'), /capacity 4/);
  assert.match(validateLevelConfig(unknownColor).join('\n'), /unknown color ochre/);
  assert.match(validateLevelConfig(wrongTotal).join('\n'), /color rose must total 4 layers/);
});

test('validation rejects completed bottles, insufficient empty bottles, and constrained openings', () => {
  const completed = withConfig({
    id: 'level-004',
    number: 4,
    completionRule: { type: 'all-colors', targetCount: 8 },
    initialState: withBottle(DEMO_LEVEL_CONFIG.initialState, 0, {
      layers: ['rose', 'rose', 'rose', 'rose'],
      status: 'active',
    }),
  });
  const oneEmpty = withConfig({
    id: 'level-004',
    number: 4,
    completionRule: { type: 'all-colors', targetCount: 8 },
    initialState: withBottle(DEMO_LEVEL_CONFIG.initialState, 10, {
      layers: [],
      status: 'inactive',
    }),
  });
  const noOpenings = withConfig({
    id: 'level-004',
    number: 4,
    completionRule: { type: 'all-colors', targetCount: 8 },
    initialState: {
      ...DEMO_LEVEL_CONFIG.initialState,
      bottles: DEMO_LEVEL_CONFIG.initialState.bottles.map((bottle, index): BottleState => {
        if (index === 8 || index === 9 || index === 10) {
          return { layers: [], status: 'inactive' };
        }
        return bottle;
      }),
    },
  });

  assert.match(validateLevelConfig(completed).join('\n'), /initial completed bottle/);
  assert.match(validateLevelConfig(oneEmpty).join('\n'), /at least 2 active empty bottles/);
  assert.match(validateLevelConfig(noOpenings).join('\n'), /at least 2 legal opening moves/);
});
