import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHAPTERS,
  chapterForLevel,
  getChapter,
  publishedChapters,
} from '../assets/scripts/core/chapter-catalog.ts';

test('catalog defines ten non-overlapping thirty-level chapters and publishes the first six', () => {
  assert.equal(CHAPTERS.length, 10);
  assert.deepEqual(CHAPTERS.map((chapter) => chapter.firstLevel), [
    1, 31, 61, 91, 121, 151, 181, 211, 241, 271,
  ]);
  assert.deepEqual(publishedChapters().map((chapter) => chapter.id), [1, 2, 3, 4, 5, 6]);
  assert.equal(chapterForLevel(30)?.id, 1);
  assert.equal(chapterForLevel(31)?.id, 2);
  assert.equal(chapterForLevel(61)?.id, 3);
  assert.equal(chapterForLevel(91)?.id, 4);
  assert.equal(chapterForLevel(121)?.id, 5);
  assert.equal(chapterForLevel(151)?.id, 6);
});

test('title order follows the approved reference', () => {
  assert.deepEqual(CHAPTERS.map((chapter) => chapter.stageTitle), [
    '见习魔女', '初级魔女', '熟练魔女', '高级魔女', '炼金大师',
    '炼金导师', '大魔女', '星辉魔女', '月之魔女', '传奇炼金师',
  ]);
});

test('chapter two keeps its approved herb theme and forest collection identity', () => {
  assert.deepEqual(getChapter(2), {
    id: 2,
    stageTitle: '初级魔女',
    themeTitle: '草药与自然',
    firstLevel: 31,
    levelCount: 30,
    collectionId: 'forest-potion',
    releaseState: 'available',
  });
});

test('chapter three publishes the approved moonlight theme and potion identity', () => {
  assert.deepEqual(getChapter(3), {
    id: 3,
    stageTitle: '熟练魔女',
    themeTitle: '月光魔法',
    firstLevel: 61,
    levelCount: 30,
    collectionId: 'moon-glow-potion',
    releaseState: 'available',
  });
});

test('chapter four publishes the approved elemental theme and flame potion identity', () => {
  assert.deepEqual(getChapter(4), {
    id: 4,
    stageTitle: '高级魔女',
    themeTitle: '元素炼金',
    firstLevel: 91,
    levelCount: 30,
    collectionId: 'flame-potion',
    releaseState: 'available',
  });
});

test('chapter five publishes the approved frost theme and ice crystal potion identity', () => {
  assert.deepEqual(getChapter(5), {
    id: 5,
    stageTitle: '炼金大师',
    themeTitle: '冰霜炼金',
    firstLevel: 121,
    levelCount: 30,
    collectionId: 'ice-crystal-potion',
    releaseState: 'available',
  });
});

test('chapter six publishes the approved wind theme and wind spirit potion identity', () => {
  assert.deepEqual(getChapter(6), {
    id: 6,
    stageTitle: '炼金导师',
    themeTitle: '风灵炼金',
    firstLevel: 151,
    levelCount: 30,
    collectionId: 'wind-spirit-potion',
    releaseState: 'available',
  });
});

test('catalog lookup rejects out-of-range chapter and level values', () => {
  assert.equal(getChapter(0), null);
  assert.equal(getChapter(11), null);
  assert.equal(chapterForLevel(0), null);
  assert.equal(chapterForLevel(301), null);
});

test('published chapter data cannot be mutated through catalog results', () => {
  assert.equal(Object.isFrozen(CHAPTERS), true);
  assert.equal(Object.isFrozen(CHAPTERS[0]), true);
  assert.equal(Object.isFrozen(publishedChapters()), true);
});
