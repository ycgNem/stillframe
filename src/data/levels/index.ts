// Every chapter and level in play order (GAME_DESIGN §9): five chapters of eight, the eighth a boss.
import { CH1 } from './ch1';
import { CH2 } from './ch2';
import { CH3 } from './ch3';
import { CH4 } from './ch4';
import { CH5 } from './ch5';
import type { LevelDef } from './types';

export interface ChapterDef {
  n: number;
  name: string;
  setting: string;
  /** the line under "Chapter N complete" */
  outro: string;
  /** one line about this chapter, shown when the one before it ends */
  teaser: string;
  levels: LevelDef[];
}

export const CHAPTERS: ChapterDef[] = [
  { n: 1, name: 'Nine to Five', setting: 'Office floors', outro: 'you clocked out early.', teaser: 'It starts in the office.', levels: CH1 },
  { n: 2, name: 'Rush Hour', setting: 'The subway', outro: 'you missed your train on purpose.', teaser: 'Down into the subway, where the trains keep time too.', levels: CH2 },
  { n: 3, name: 'Under Construction', setting: 'Rooftops and scaffolds', outro: 'the long way down was theirs.', teaser: 'Up onto the rooftops, where the edge does the work.', levels: CH3 },
  { n: 4, name: 'Strobe', setting: 'A white nightclub', outro: 'the music stopped when you did.', teaser: 'Into the club, where the beat keeps game time.', levels: CH4 },
  { n: 5, name: 'The Core', setting: 'The white void', outro: 'the frame let you go.', teaser: 'Into the core, where the rules come loose.', levels: CH5 },
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
