import { CHAPTERS } from './chapter-catalog.ts';

export interface PotionCollectionConfig {
  readonly chapterId: number;
  readonly collectionId: string;
  readonly name: string;
  readonly description: string;
  readonly artworkKey: string | null;
  readonly silhouetteIndex: number | null;
}

export const POTION_COLLECTIONS: readonly PotionCollectionConfig[] = Object.freeze(CHAPTERS.map((chapter, index) => Object.freeze({
  chapterId: chapter.id,
  collectionId: chapter.collectionId,
  name: index === 0 ? '星露药水' : '???',
  description: index === 0 ? '收集夜空星辉的稀有药水' : '',
  artworkKey: index === 0 ? 'star-dew-potion' : null,
  silhouetteIndex: index === 0 ? null : index - 1,
})));

export function getPotionCollection(chapterId: number): PotionCollectionConfig | null {
  return Number.isInteger(chapterId) && chapterId >= 1 && chapterId <= POTION_COLLECTIONS.length
    ? POTION_COLLECTIONS[chapterId - 1] : null;
}
