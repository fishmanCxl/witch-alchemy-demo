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

test('the first six collections expose approved artwork while later chapters use distinct silhouettes', () => {
  assert.equal(POTION_COLLECTIONS[0].name, '星露药水');
  assert.equal(POTION_COLLECTIONS[0].artworkKey, 'star-dew-potion');
  assert.equal(POTION_COLLECTIONS[0].silhouetteIndex, null);
  assert.deepEqual(getPotionCollection(2), {
    chapterId: 2,
    collectionId: 'forest-potion',
    name: '森林药水',
    description: '凝聚古林生机与草木萤光的稀有药水',
    artworkKey: 'forest-potion',
    silhouetteIndex: 0,
  });
  assert.deepEqual(getPotionCollection(3), {
    chapterId: 3,
    collectionId: 'moon-glow-potion',
    name: '月辉药水',
    description: '凝聚静谧月华与银蓝星尘的稀有药水',
    artworkKey: 'moon-glow-potion',
    silhouetteIndex: 1,
  });
  assert.deepEqual(getPotionCollection(4), {
    chapterId: 4,
    collectionId: 'flame-potion',
    name: '火焰药水',
    description: '凝聚赤金元素火焰与炽热火星的稀有药水',
    artworkKey: 'flame-potion',
    silhouetteIndex: 2,
  });
  assert.deepEqual(getPotionCollection(5), {
    chapterId: 5,
    collectionId: 'ice-crystal-potion',
    name: '冰晶药水',
    description: '凝聚极寒冰晶与青蓝雪尘的稀有药水',
    artworkKey: 'ice-crystal-potion',
    silhouetteIndex: 3,
  });
  assert.deepEqual(getPotionCollection(6), {
    chapterId: 6,
    collectionId: 'wind-spirit-potion',
    name: '风灵药水',
    description: '凝聚高天清风与灵羽微光的稀有药水',
    artworkKey: 'wind-spirit-potion',
    silhouetteIndex: 4,
  });
  assert.deepEqual(POTION_COLLECTIONS.slice(6).map((item) => item.name), Array(4).fill('???'));
  assert.equal(
    new Set(POTION_COLLECTIONS.slice(6).map((item) => item.silhouetteIndex)).size,
    4,
  );
});

test('collection lookup rejects invalid chapter ids', () => {
  assert.equal(getPotionCollection(1), POTION_COLLECTIONS[0]);
  assert.equal(getPotionCollection(0), null);
  assert.equal(getPotionCollection(11), null);
});
