import test from 'node:test';
import assert from 'node:assert/strict';

import { CHAPTERS } from '../assets/scripts/core/chapter-catalog.ts';
import {
  POTION_COLLECTIONS,
  getPotionCollection,
} from '../assets/scripts/core/potion-collection-catalog.ts';

test('collection catalog maps all ten chapters to stable collection identities', () => {
  assert.equal(POTION_COLLECTIONS.length, 10);
  assert.deepEqual(POTION_COLLECTIONS.map((item) => item.chapterId), [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.deepEqual(
    POTION_COLLECTIONS.map((item) => item.collectionId),
    CHAPTERS.map((chapter) => chapter.collectionId),
  );
  assert.equal(Object.isFrozen(POTION_COLLECTIONS), true);
  assert.equal(Object.isFrozen(POTION_COLLECTIONS[0]), true);
});

test('only star dew exposes finished artwork while locked chapters use distinct silhouettes', () => {
  assert.equal(POTION_COLLECTIONS[0].name, '星露药水');
  assert.equal(POTION_COLLECTIONS[0].artworkKey, 'star-dew-potion');
  assert.equal(POTION_COLLECTIONS[0].silhouetteIndex, null);
  assert.deepEqual(POTION_COLLECTIONS.slice(1).map((item) => item.name), Array(9).fill('???'));
  assert.equal(
    new Set(POTION_COLLECTIONS.slice(1).map((item) => item.silhouetteIndex)).size,
    9,
  );
});

test('collection lookup rejects invalid chapter ids', () => {
  assert.equal(getPotionCollection(1), POTION_COLLECTIONS[0]);
  assert.equal(getPotionCollection(0), null);
  assert.equal(getPotionCollection(11), null);
});
