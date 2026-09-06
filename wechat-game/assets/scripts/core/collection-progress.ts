import { CHAPTERS, getChapter, type ChapterConfig } from './chapter-catalog.ts';
import { levelNumber } from './level-config.ts';
import type { PlayerProgress } from './level-progress.ts';

export interface CollectionProgress {
  readonly chapterId: number;
  readonly completedLevels: number;
  readonly revealedPieces: number;
  readonly totalPieces: 6;
  readonly collected: boolean;
  readonly nextMilestone: number | null;
}

export interface HighestTitle {
  readonly chapterId: number;
  readonly title: string;
}

export interface CompletionReward {
  readonly puzzlePiece: number | null;
  readonly collectionCompleted: boolean;
  readonly titleChanged: boolean;
}

function completedInChapter(completedThrough: number, chapter: ChapterConfig): number {
  return Math.min(
    chapter.levelCount,
    Math.max(0, completedThrough - chapter.firstLevel + 1),
  );
}

export function deriveCollectionProgress(
  progress: PlayerProgress,
  chapterId: number,
): CollectionProgress {
  const chapter = getChapter(chapterId);
  if (chapter === null) throw new RangeError('chapter ID must be an integer from 1 to 10');

  const completedLevels = completedInChapter(progress.completedThrough, chapter);
  const revealedPieces = Math.floor(completedLevels / 5);
  const collected = revealedPieces === 6;
  return {
    chapterId,
    completedLevels,
    revealedPieces,
    totalPieces: 6,
    collected,
    nextMilestone: collected ? null : (revealedPieces + 1) * 5,
  };
}

export function deriveHighestTitle(progress: PlayerProgress): HighestTitle {
  let completedChapters = 0;
  for (const chapter of CHAPTERS) {
    if (completedInChapter(progress.completedThrough, chapter) !== chapter.levelCount) break;
    completedChapters += 1;
  }
  const titleChapter = CHAPTERS[Math.min(completedChapters, CHAPTERS.length - 1)];
  return { chapterId: titleChapter.id, title: titleChapter.stageTitle };
}

export function deriveCompletionReward(
  before: PlayerProgress,
  after: PlayerProgress,
  levelId: string,
): CompletionReward {
  const chapter = chapterForCompletedLevel(levelId);
  if (chapter === null) {
    return { puzzlePiece: null, collectionCompleted: false, titleChanged: false };
  }

  const beforeCollection = deriveCollectionProgress(before, chapter.id);
  const afterCollection = deriveCollectionProgress(after, chapter.id);
  const puzzlePiece = afterCollection.revealedPieces > beforeCollection.revealedPieces
    ? afterCollection.revealedPieces
    : null;

  return {
    puzzlePiece,
    collectionCompleted: !beforeCollection.collected && afterCollection.collected,
    titleChanged: deriveHighestTitle(before).title !== deriveHighestTitle(after).title,
  };
}

function chapterForCompletedLevel(id: string): ChapterConfig | null {
  const number = levelNumber(id);
  return number === null ? null : getChapter(Math.floor((number - 1) / 30) + 1);
}
