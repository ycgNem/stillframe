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
  { id: 'stride', name: 'Stride', blurb: 'You outpace time', tiers: ['You move 15% faster than it', 'You move 30% faster than it', 'You move 45% faster than it'] },
  { id: 'trigger', name: 'Trigger', blurb: 'Shorter action bursts', tiers: ['A burst lasts 0.10 s', 'A burst lasts 0.04 s', 'A burst lasts 0.02 s'] },
  { id: 'shield', name: 'Shield', blurb: 'Survive a hit', tiers: ['One free hit per level', 'Its break stuns reds nearby', 'Two free hits per level'] },
  { id: 'frameskip', name: 'Frameskip', blurb: '[Space] dashes in zero time', tiers: ['3 tiles, 4 s cooldown', '4 tiles, 2.5 s cooldown', 'Dashing through a red shatters it'] },
  { id: 'rewind', name: 'Rewind', blurb: 'Die, jump back 2 seconds', tiers: ['One charge per level', 'Two charges per level', 'Charges refill each wave'] },
  { id: 'arm', name: 'Arm', blurb: 'Better throws', tiers: ['Throws fly 25% faster', 'Throws shatter Grunts and Gunners', 'Throws ricochet once'] },
  { id: 'mag', name: 'Mag', blurb: 'Ammo on pickup', tiers: ['+1 round in every gun', '+2 rounds in every gun', '+3 rounds in every gun'] },
  { id: 'reach', name: 'Reach', blurb: 'Grab from further', tiers: ['Pick up from 1.5 tiles', 'Pick up from 2 tiles', 'Catch thrown things mid-air'] },
];

/** Per-tier values the sim and the time rule read. Index 0 = not bought. */
export const TIER_VALUES = {
  /** your walking speed against game time; the time rule divides the walking scale by the same, so you
   *  cross the room as fast as ever in real time while the world slows around you */
  strideSpeed: [1, 1.15, 1.3, 1.45],
  triggerBurst: [0.18, 0.1, 0.04, 0.02],
  shieldHits: [0, 1, 1, 2],
  rewindCharges: [0, 1, 2, 2],
  armSpeed: [1, 1.25, 1.25, 1.25],
  magBonus: [0, 1, 2, 3],
  reach: [20, 26, 34, 34],
};

/** Carry two items; Q or the mouse wheel swaps. */
export const HOLSTER = { name: 'Holster', blurb: 'Carry two things. [Q] or the wheel swaps.', price: 120 };

/** Start each level holding one of these, once bought. `after` is the level where it first appears. */
export const LOADOUT: { item: ItemKind; price: number; after: string }[] = [
  { item: 'pistol', price: 80, after: '1-1' },
  { item: 'shotgun', price: 160, after: '1-8' },
  { item: 'smg', price: 220, after: '3-1' },
  { item: 'katana', price: 260, after: '4-1' },
];
