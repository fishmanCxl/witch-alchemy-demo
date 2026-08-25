import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHAPTERS,
  chapterForLevel,
  getChapter,
  publishedChapters,
} from '../assets/scripts/core/chapter-catalog.ts';

test('catalog defines ten non-overlapping thirty-level chapters and only chapter one is available', () => {
  assert.equal(CHAPTERS.length, 10);
  assert.deepEqual(CHAPTERS.map((chapter) => chapter.firstLevel), [
    1, 31, 61, 91, 121, 151, 181, 211, 241, 271,
  ]);
  assert.deepEqual(publishedChapters().map((chapter) => chapter.id), [1]);
  assert.equal(chapterForLevel(30)?.id, 1);
  assert.equal(chapterForLevel(31)?.id, 2);
});

test('title order follows the approved reference', () => {
  assert.deepEqual(CHAPTERS.map((chapter) => chapter.stageTitle), [
    '见习魔女', '初级魔女', '熟练魔女', '高级魔女', '炼金大师',
    '炼金导师', '大魔女', '星辉魔女', '月之魔女', '传奇炼金师',
  ]);
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
