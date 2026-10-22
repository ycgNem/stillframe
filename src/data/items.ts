// Weapons and throwables (GAME_DESIGN §6). Guns have no reload: when empty, you throw them.

export type ItemKind = 'pistol' | 'shotgun' | 'bottle' | 'mug' | 'keyboard' | 'ashtray' | 'desk';

export interface ItemDef {
  name: string;
  /** a gun shoots; anything else is only thrown */
  gun: boolean;
  /** rounds when found */
  ammo: number;
  /** game seconds between shots */
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
  /** only the Manager throws desks: big, slow and lethal */
  radius?: number;
}

const THROWABLE = { gun: false, ammo: 0, cooldown: 0, pellets: 0, spread: 0, speed: 0, range: 0, damage: 0, breaks: true };

export const ITEMS: Record<ItemKind, ItemDef> = {
  pistol: { name: 'PISTOL', gun: true, ammo: 6, cooldown: 0.3, pellets: 1, spread: 0, speed: 220, range: 600, damage: 3, breaks: false },
  shotgun: { name: 'SHOTGUN', gun: true, ammo: 2, cooldown: 0.8, pellets: 5, spread: 0.35, speed: 200, range: 80, damage: 3, breaks: false },
  bottle: { ...THROWABLE, name: 'BOTTLE' },
  mug: { ...THROWABLE, name: 'MUG' },
  keyboard: { ...THROWABLE, name: 'KEYBOARD' },
  ashtray: { ...THROWABLE, name: 'ASHTRAY' },
  desk: { ...THROWABLE, name: 'DESK', radius: 6 },
};

/** Map letters for items lying on the floor (src/data/levels). */
export const ITEM_LETTERS: Record<string, ItemKind> = { p: 'pistol', s: 'shotgun', b: 'bottle', m: 'mug', k: 'keyboard', a: 'ashtray' };
