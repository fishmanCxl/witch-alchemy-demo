import test from 'node:test';
import assert from 'node:assert/strict';

import { getChapter, publishedChapters } from '../assets/scripts/core/chapter-catalog.ts';
import { deriveCollectionProgress, deriveHighestTitle } from '../assets/scripts/core/collection-progress.ts';
import { getLevelConfig, levelsForChapter, nextLevelConfig, PUBLISHED_LEVELS } from '../assets/scripts/core/level-catalog.ts';
import { completeLevel, createDefaultProgress } from '../assets/scripts/core/level-progress.ts';
import { getPotionCollection } from '../assets/scripts/core/potion-collection-catalog.ts';

test('chapters seven and eight publish sixty unique eleven-color boards within fourteen ordinary slots', () => {
  assert.deepEqual(publishedChapters().map((chapter) => chapter.id), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(PUBLISHED_LEVELS.length, 240);
  assert.equal(new Set(PUBLISHED_LEVELS.map((level) => JSON.stringify(level.initialState.bottles))).size, 240);
  for (const [chapterId, first] of [[7, 181], [8, 211]]) {
    const levels = levelsForChapter(chapterId);
    assert.deepEqual(levels.map((level) => level.number), Array.from({ length: 30 }, (_, i) => first + i));
    for (const level of levels) {
      assert.equal(level.metrics.colorCount, 11, level.id);
      assert.equal(level.initialState.bottles[14].status, 'reserved', level.id);
      assert.equal(level.initialState.bottles.filter((bottle) => bottle.status === 'active' && bottle.layers.length === 0).length, 2, level.id);
    }
  }
  assert.equal(getChapter(7)?.themeTitle, '禁忌炼金');
  assert.equal(getChapter(8)?.themeTitle, '星辰炼金');
  assert.equal(getChapter(9)?.releaseState, 'coming-soon');
});

test('completion crosses 180 and 210, then caps at 240 while 241 stays unpublished', () => {
  assert.equal(nextLevelConfig('level-180')?.id, 'level-181');
  assert.equal(nextLevelConfig('level-210')?.id, 'level-211');
  assert.equal(nextLevelConfig('level-240'), null);
  assert.equal(getLevelConfig('level-241'), null);
  for (const [before, current, after] of [[179, 'level-180', 'level-181'], [209, 'level-210', 'level-211'], [239, 'level-240', 'level-240']] as const) {
    const progress = { ...createDefaultProgress(), completedThrough: before, currentLevel: current };
    const completed = completeLevel(progress, current, 50);
    assert.equal(completed?.completedThrough, before + 1);
    assert.equal(completed?.currentLevel, after);
  }
});

test('new chapter collections unlock their existing puzzle and title flow', () => {
  assert.equal(getPotionCollection(7)?.artworkKey, 'shadow-potion');
  assert.equal(getPotionCollection(8)?.artworkKey, 'stellar-potion');
  for (const [chapterId, end, title] of [[7, 210, '星辉魔女'], [8, 240, '月之魔女']] as const) {
    const progress = { ...createDefaultProgress(), completedThrough: end };
    assert.equal(deriveCollectionProgress(progress, chapterId).revealedPieces, 6);
    assert.equal(deriveHighestTitle(progress).title, title);
  }
});
