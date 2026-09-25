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
  name: index === 0 ? '星露药水' : index === 1 ? '森林药水' : index === 2 ? '月辉药水' : index === 3 ? '火焰药水' : index === 4 ? '冰晶药水' : index === 5 ? '风灵药水' : index === 6 ? '暗影药水' : index === 7 ? '星辰药水' : index === 8 ? '月神药水' : '贤者药水',
  description: index === 0
    ? '收集夜空星辉的稀有药水'
    : index === 1 ? '凝聚古林生机与草木萤光的稀有药水'
      : index === 2 ? '凝聚静谧月华与银蓝星尘的稀有药水'
        : index === 3 ? '凝聚赤金元素火焰与炽热火星的稀有药水'
          : index === 4 ? '凝聚极寒冰晶与青蓝雪尘的稀有药水'
            : index === 5 ? '凝聚高天清风与灵羽微光的稀有药水'
              : index === 6 ? '凝聚禁忌暗影与幽紫秘雾的稀有药水'
                : index === 7 ? '凝聚星辰辉光与靛蓝星轨的稀有药水'
                  : index === 8 ? '凝聚月神秘术与银紫月华的稀有药水' : '凝聚终极炼金智慧与赤金贤者之光的稀有药水',
  artworkKey: index === 0 ? 'star-dew-potion' : index === 1 ? 'forest-potion' : index === 2 ? 'moon-glow-potion' : index === 3 ? 'flame-potion' : index === 4 ? 'ice-crystal-potion' : index === 5 ? 'wind-spirit-potion' : index === 6 ? 'shadow-potion' : index === 7 ? 'stellar-potion' : index === 8 ? 'moon-goddess-potion' : 'sage-potion',
  silhouetteIndex: index === 0 ? null : index - 1,
})));

export function getPotionCollection(chapterId: number): PotionCollectionConfig | null {
  return Number.isInteger(chapterId) && chapterId >= 1 && chapterId <= POTION_COLLECTIONS.length
    ? POTION_COLLECTIONS[chapterId - 1] : null;
}
