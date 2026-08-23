import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDemoState } from '../assets/scripts/core/demo-level.ts';
import {
  DEMO_LEVEL_CONFIG,
  levelId,
  validateLevelConfig,
  type CompletionRule,
  type LevelConfig,
  type LevelMetrics,
} from '../assets/scripts/core/level-config.ts';
import type { BottleState, GameState, PotionColor } from '../assets/scripts/core/types.ts';
import {
  analyzeState,
  generateCandidate,
  type GeneratedCandidate,
  type GenerationScoreComponents,
  type GenerationSpec,
} from './level-generator.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = resolve(ROOT, 'assets/scripts/core/level-data.generated.ts');
const REPORT_PATH = resolve(ROOT, 'assets/scripts/core/level-generation-report.json');
const CONFIG_VERSION = 'chapter-1.2026-08-23.1';

interface ReportLevel {
  readonly id: string;
  readonly source: 'tutorial' | 'generated' | 'legacy';
  readonly generatorSeed: number | null;
  readonly attempt: number | null;
  readonly reverseMoves: number | null;
  readonly metrics: LevelMetrics;
  readonly scoreComponents: GenerationScoreComponents | null;
}

function active(layers: readonly PotionColor[]): BottleState {
  return { layers: [...layers], status: 'active' };
}

function tutorialState(groups: readonly (readonly PotionColor[])[]): GameState {
  const bottles: BottleState[] = groups.map(active);
  bottles.push(active([]), active([]));
  while (bottles.length < 14) bottles.push({ layers: [], status: 'inactive' });
  bottles.push({ layers: [], status: 'reserved' });
  return { bottles, rewardBottleUsed: false, moves: 0 };
}

function authoredTutorial(
  number: number,
  state: GameState,
  colorCount: number,
  completionRule: CompletionRule,
  difficultyScore: number,
): { readonly config: LevelConfig; readonly report: ReportLevel } {
  const analysis = analyzeState(state, colorCount, completionRule);
  if (!analysis) throw new Error(`Tutorial level ${number} is not solvable`);
  const metrics = { ...analysis.metrics, difficultyScore };
  const config: LevelConfig = {
    id: levelId(number),
    number,
    configVersion: CONFIG_VERSION,
    presentationSeed: number,
    capacity: 4,
    slotCount: 15,
    rewardSlotIndex: 14,
    completionRule,
    metrics,
    initialState: state,
  };
  return {
    config,
    report: {
      id: config.id,
      source: 'tutorial',
      generatorSeed: null,
      attempt: null,
      reverseMoves: null,
      metrics,
      scoreComponents: analysis.scoreComponents,
    },
  };
}

function generatedLevel(
  spec: GenerationSpec,
  seed: number,
): { readonly config: LevelConfig; readonly report: ReportLevel } {
  const candidate: GeneratedCandidate = generateCandidate(spec, seed);
  const config: LevelConfig = {
    id: levelId(spec.number),
    number: spec.number,
    configVersion: CONFIG_VERSION,
    presentationSeed: spec.number,
    capacity: 4,
    slotCount: 15,
    rewardSlotIndex: 14,
    completionRule: { type: 'all-colors', targetCount: spec.colorCount },
    metrics: candidate.metrics,
    initialState: candidate.initialState,
  };
  return {
    config,
    report: {
      id: config.id,
      source: 'generated',
      generatorSeed: candidate.seed,
      attempt: candidate.attempt,
      reverseMoves: candidate.inverseMoves.length,
      metrics: candidate.metrics,
      scoreComponents: candidate.scoreComponents,
    },
  };
}

function spec(
  number: number,
  colorCount: number,
  reverseMoves: number,
  minimumDifficulty: number,
  maximumDifficulty: number,
  maxAttempts = 500,
): GenerationSpec {
  return {
    number,
    colorCount,
    emptyBottleCount: 2,
    reverseMoves,
    minimumDifficulty,
    maximumDifficulty,
    maxAttempts,
  };
}

function buildPublishedLevels(): {
  readonly levels: readonly LevelConfig[];
  readonly report: readonly ReportLevel[];
} {
  const tutorialEntries = [
    authoredTutorial(
      1,
      tutorialState([['rose'], ['rose', 'rose', 'rose']]),
      1,
      { type: 'first-valid-pour' },
      300,
    ),
    authoredTutorial(
      2,
      tutorialState([
        ['amber', 'rose'],
        ['rose', 'rose', 'rose'],
        ['amber', 'amber', 'amber'],
      ]),
      2,
      { type: 'first-bottle-complete' },
      600,
    ),
    authoredTutorial(
      3,
      tutorialState([
        ['rose'],
        ['rose', 'rose', 'rose'],
        ['amber'],
        ['amber', 'amber', 'amber'],
      ]),
      2,
      { type: 'all-colors', targetCount: 2 },
      900,
    ),
  ];

  const anchorAnalysis = analyzeState(
    createDemoState(),
    8,
    { type: 'all-colors', targetCount: 8 },
  );
  if (!anchorAnalysis) throw new Error('Frozen level 12 exceeds the solver budget');
  const anchor: LevelConfig = {
    ...DEMO_LEVEL_CONFIG,
    metrics: anchorAnalysis.metrics,
  };

  const preAnchorRequests = [
    [spec(4, 3, 7, 0, 1_606), 1_004],
    [spec(5, 3, 9, 1_607, 1_658), 1_005],
    [spec(6, 4, 10, 1_659, 1_706), 6_006],
    [spec(7, 4, 11, 1_707, 1_758), 17_011],
    [spec(8, 5, 13, 1_759, 1_830), 1_008],
    [spec(9, 5, 15, 1_831, 1_846), 1_009],
    [spec(10, 6, 17, 1_847, 1_888), 1_010],
    [spec(11, 7, 19, 1_889, anchor.metrics.difficultyScore), 1_011],
  ] as const;
  const postAnchorRequests = [
    [spec(13, 8, 22, anchor.metrics.difficultyScore, 2_178), 7_022],
    [spec(14, 8, 23, 2_179, 2_202), 7_023],
    [spec(15, 8, 24, 2_203, 3_000, 2_000), 15_024],
  ] as const;
  const preAnchor = preAnchorRequests.map(([request, seed]) => generatedLevel(request, seed));
  const postAnchor = postAnchorRequests.map(([request, seed]) => generatedLevel(request, seed));
  const anchorReport: ReportLevel = {
    id: anchor.id,
    source: 'legacy',
    generatorSeed: null,
    attempt: null,
    reverseMoves: null,
    metrics: anchor.metrics,
    scoreComponents: anchorAnalysis.scoreComponents,
  };

  const entries = [
    ...tutorialEntries,
    ...preAnchor,
    { config: anchor, report: anchorReport },
    ...postAnchor,
  ];
  const scores = entries.map(({ config }) => config.metrics.difficultyScore);
  if (scores.some((score, index) => index > 0 && score < scores[index - 1])) {
    throw new Error(`Published difficulty is not monotonic: ${scores.join(', ')}`);
  }
  for (const { config } of entries) {
    const errors = validateLevelConfig(config);
    if (errors.length > 0) throw new Error(`${config.id}: ${errors.join('; ')}`);
  }

  return {
    levels: entries.map(({ config }) => config),
    report: entries.map(({ report }) => report),
  };
}

function generatedTypeScript(levels: readonly LevelConfig[]): string {
  return [
    "import type { LevelConfig } from './level-config.ts';",
    '',
    '// Generated by tools/generate-levels.ts. Do not edit by hand.',
    `export const PUBLISHED_LEVEL_DATA: readonly LevelConfig[] = ${JSON.stringify(levels, null, 2)};`,
    '',
  ].join('\n');
}

function generatedReport(report: readonly ReportLevel[]): string {
  return `${JSON.stringify({
    schemaVersion: 1,
    configVersion: CONFIG_VERSION,
    levels: report,
  }, null, 2)}\n`;
}

function checkOrWrite(path: string, content: string, check: boolean): boolean {
  if (check) return existsSync(path) && readFileSync(path, 'utf8') === content;
  writeFileSync(path, content, 'utf8');
  return true;
}

const check = process.argv.includes('--check');
const published = buildPublishedLevels();
const matches = [
  checkOrWrite(DATA_PATH, generatedTypeScript(published.levels), check),
  checkOrWrite(REPORT_PATH, generatedReport(published.report), check),
].every(Boolean);

if (!matches) {
  console.error('Published level output differs from deterministic generation');
  process.exitCode = 1;
} else if (check) {
  console.log('15 published levels match generated output');
} else {
  console.log('Generated 15 published levels and difficulty report');
}

