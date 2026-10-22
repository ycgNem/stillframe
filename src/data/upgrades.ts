// The Workshop (GAME_DESIGN §11): 8 tracks of 3 tiers, a Holster, and loadout weapons.
import type { ItemKind } from './items';

export type TrackId = 'stride' | 'trigger' | 'shield' | 'frameskip' | 'rewind' | 'arm' | 'mag' | 'reach';

export interface TrackDef {
  id: TrackId;
  name: string;
  /** one line under the name */
  blurb: string;
  /** what each tier gives, I to III */
  tiers: [string, string, string];
}

/** Coins for tier I, II, III of any track. */
export const TIER_PRICES = [40, 100, 200] as const;

export const TRACKS: TrackDef[] = [
  { id: 'stride', name: 'STRIDE', blurb: 'WALKING RUNS TIME SLOWER', tiers: ['WALK AT 85% TIME', 'WALK AT 72% TIME', 'WALK AT 60% TIME'] },
  { id: 'trigger', name: 'TRIGGER', blurb: 'SHORTER ACTION BURSTS', tiers: ['BURST 0.14 S', 'BURST 0.10 S', 'BURST 0.06 S'] },
  { id: 'shield', name: 'SHIELD', blurb: 'SURVIVE A HIT', tiers: ['1 FREE HIT PER LEVEL', 'ITS BREAK STUNS REDS NEARBY', '2 FREE HITS'] },
  { id: 'frameskip', name: 'FRAMESKIP', blurb: 'SPACE: DASH IN ZERO TIME', tiers: ['3 TILES, 4 S COOLDOWN', '4 TILES, 2.5 S COOLDOWN', 'DASHING THROUGH REDS SHATTERS THEM'] },
  { id: 'rewind', name: 'REWIND', blurb: 'DIE, JUMP BACK 2 SECONDS', tiers: ['1 CHARGE PER LEVEL', '2 CHARGES', 'CHARGES REFILL EACH WAVE'] },
  { id: 'arm', name: 'ARM', blurb: 'BETTER THROWS', tiers: ['THROWS FLY 25% FASTER', 'THROWS SHATTER GRUNTS', 'THROWS RICOCHET ONCE'] },
  { id: 'mag', name: 'MAG', blurb: 'AMMO ON PICKUP', tiers: ['+1 ROUND', '+2 ROUNDS', '+3 ROUNDS'] },
  { id: 'reach', name: 'REACH', blurb: 'GRAB FROM FURTHER', tiers: ['1.5 TILES', '2 TILES', 'CATCH THROWN ITEMS'] },
];

/** Per-tier values the sim and the time rule read. Index 0 = not bought. */
export const TIER_VALUES = {
  strideWalk: [1, 0.85, 0.72, 0.6],
  triggerBurst: [0.18, 0.14, 0.1, 0.06],
  shieldHits: [0, 1, 1, 2],
  rewindCharges: [0, 1, 2, 2],
  armSpeed: [1, 1.25, 1.25, 1.25],
  magBonus: [0, 1, 2, 3],
  reach: [20, 26, 34, 34],
};

/** Carry two items; Q or the mouse wheel swaps. */
export const HOLSTER = { name: 'HOLSTER', blurb: 'CARRY TWO ITEMS (Q SWAPS)', price: 120 };

/** Start each level holding one of these, once bought. `after` is the level where it first appears. */
export const LOADOUT: { item: ItemKind; price: number; after: string }[] = [
  { item: 'pistol', price: 80, after: '1-1' },
  { item: 'shotgun', price: 160, after: '1-8' },
];
