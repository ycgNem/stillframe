// Weapons and throwables (GAME_DESIGN §6). Guns have no reload: when empty, you throw them.

export type ItemKind = 'pistol' | 'shotgun' | 'smg' | 'rifle' | 'katana' | 'bottle' | 'mug' | 'keyboard' | 'ashtray' | 'desk' | 'beam' | 'record';

export interface ItemDef {
  name: string;
  /** a gun shoots; anything else is only thrown (or swung) */
  gun: boolean;
  /** rounds when found */
  ammo: number;
  /** game seconds between shots (between bursts for a burst gun), or between slashes */
  cooldown: number;
  pellets: number;
  /** full spread of the pellets, radians */
  spread: number;
  /** bullet speed, px per game s */
  speed: number;
  /** bullets vanish after this many px */
  range: number;
  damage: number;
  /** a thrown one breaks on impact instead of landing */
  breaks: boolean;
  /** what a red throws that only it can throw (the Manager's desk, the Foreman's beam): big, slow and lethal */
  radius?: number;
  /** a burst gun fires this many rounds per click, `burstGap` game s apart */
  burst?: number;
  burstGap?: number;
  /** its bullet goes on through what it shatters */
  pierce?: boolean;
  /** a blade: a click slashes everything in an arc in front of you, cutting bullets out of the air */
  blade?: { reach: number; arc: number };
}

const THROWABLE = { gun: false, ammo: 0, cooldown: 0, pellets: 0, spread: 0, speed: 0, range: 0, damage: 0, breaks: true };

export const ITEMS: Record<ItemKind, ItemDef> = {
  pistol: { name: 'Pistol', gun: true, ammo: 6, cooldown: 0.3, pellets: 1, spread: 0, speed: 220, range: 600, damage: 3, breaks: false },
  shotgun: { name: 'Shotgun', gun: true, ammo: 2, cooldown: 0.8, pellets: 5, spread: 0.35, speed: 200, range: 80, damage: 3, breaks: false },
  smg: { name: 'SMG', gun: true, ammo: 12, cooldown: 0.45, pellets: 1, spread: 0, speed: 240, range: 520, damage: 3, breaks: false, burst: 3, burstGap: 0.07 },
  rifle: { name: 'Rifle', gun: true, ammo: 3, cooldown: 0.9, pellets: 1, spread: 0, speed: 520, range: 900, damage: 3, breaks: false, pierce: true },
  katana: { name: 'Katana', gun: false, ammo: 0, cooldown: 0.4, pellets: 0, spread: 0, speed: 0, range: 0, damage: 3, breaks: false, blade: { reach: 18, arc: 1.7 } },
  bottle: { ...THROWABLE, name: 'Bottle' },
  mug: { ...THROWABLE, name: 'Mug' },
  keyboard: { ...THROWABLE, name: 'Keyboard' },
  ashtray: { ...THROWABLE, name: 'Ashtray' },
  desk: { ...THROWABLE, name: 'Desk', radius: 6 },
  beam: { ...THROWABLE, name: 'Steel beam', radius: 6 },
  record: { ...THROWABLE, name: 'Record', radius: 4 },
};

/** Map letters for items lying on the floor (src/data/levels). */
export const ITEM_LETTERS: Record<string, ItemKind> = { p: 'pistol', s: 'shotgun', u: 'smg', l: 'rifle', j: 'katana', b: 'bottle', m: 'mug', k: 'keyboard', a: 'ashtray' };
