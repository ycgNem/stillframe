// The time rule (GAME_DESIGN §4): game time crawls while you stand still, runs while you move, and an
// action (shot, punch, throw, pickup) buys a short burst at full speed. It decides how many sim ticks run
// per real second; the sim never sees the scale, so a replay can play the same ticks back at real speed.
// Stride lowers the walking scale and Trigger shortens the burst.
import { TIME } from '../data/tuning';
import { TIER_VALUES } from '../data/upgrades';

export interface TimeState {
  /** game seconds per real second */
  scale: number;
  /** game seconds of action burst left */
  burst: number;
  /** walking scale and burst length after upgrades */
  walk: number;
  burstLen: number;
}

export function createTime(stride = 0, trigger = 0): TimeState {
  return { scale: TIME.idle, burst: 0, walk: TIME.walk * TIER_VALUES.strideWalk[stride], burstLen: TIER_VALUES.triggerBurst[trigger] };
}

/** Once per real frame. `move` is how hard the player is moving, 0..1. Returns the new scale. */
export function updateTime(t: TimeState, move: number, realDt: number): number {
  const m = Math.min(1, Math.max(0, move));
  const walkTarget = TIME.idle + (t.walk - TIME.idle) * m;
  const target = t.burst > 0 ? Math.max(TIME.burstScale, walkTarget) : walkTarget;
  const rate = target > t.scale ? TIME.rampUp : TIME.rampDown;
  t.scale += (target - t.scale) * Math.min(1, rate * realDt);
  return t.scale;
}

/** An action happened: full speed at once, for the burst length in game seconds. */
export function startBurst(t: TimeState, seconds = t.burstLen) {
  t.burst = Math.max(t.burst, seconds);
  t.scale = Math.max(t.scale, TIME.burstScale);
}

/** Once per sim tick: the burst is spent in game time. */
export function spendBurst(t: TimeState, gameDt: number) {
  t.burst = Math.max(0, t.burst - gameDt);
}
