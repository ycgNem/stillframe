// Every chapter and level in play order. Chapters 2–5 arrive after the MVP (docs/PLAN.md M9–M10).
import { CH1 } from './ch1';
import type { LevelDef } from './types';

export interface ChapterDef {
  n: number;
  name: string;
  setting: string;
  levels: LevelDef[];
}

export const CHAPTERS: ChapterDef[] = [{ n: 1, name: 'NINE TO FIVE', setting: 'OFFICE FLOORS', levels: CH1 }];

/** Chapters still to come, shown locked on the map. */
export const COMING: { n: number; name: string }[] = [
  { n: 2, name: 'RUSH HOUR' },
  { n: 3, name: 'UNDER CONSTRUCTION' },
  { n: 4, name: 'STROBE' },
  { n: 5, name: 'THE CORE' },
];

export const LEVELS: LevelDef[] = CHAPTERS.flatMap((c) => c.levels);

export function levelById(id: string): LevelDef {
  const l = LEVELS.find((l) => l.id === id);
  if (!l) throw new Error(`no level ${id}`);
  return l;
}

/** The level after this one, or null at the end of the content. */
export function nextLevel(id: string): LevelDef | null {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < LEVELS.length ? LEVELS[i + 1] : null;
}
