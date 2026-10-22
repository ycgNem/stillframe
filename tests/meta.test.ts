import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/data/levels';
import { COINS } from '../src/data/tuning';
import { TIER_PRICES } from '../src/data/upgrades';
import {
  applyClear, buyHolster, buyLoadout, buyTier, decodeSave, encodeSave, isUnlocked, migrate, modsOf, newSave, record,
} from '../src/meta/save';
import { tally } from '../src/meta/tally';
import { botRun } from './helpers';

describe('save file', () => {
  it('round-trips through an export code, unicode and all', () => {
    const s = newSave();
    s.coins = s.earned = 123;
    s.up.stride = 2;
    s.levels['1-1'] = { stars: [true, false, true], best: 900, clears: 2 };
    const back = decodeSave(encodeSave(s));
    expect(back).toEqual(s);
    expect(decodeSave('nonsense')).toBeNull();
    expect(decodeSave('SF1-!!!')).toBeNull();
  });

  it('migrates junk and partial saves into a valid one', () => {
    expect(migrate(null)).toEqual(newSave());
    const m = migrate({ coins: -5, up: { stride: 9, arm: 'x' }, levels: { '1-1': { stars: [1], best: 5 } }, loadout: 'pistol' });
    expect(m.coins).toBe(0);
    expect(m.up.stride).toBe(3);
    expect(m.up.arm).toBe(0);
    expect(m.levels['1-1'].stars).toEqual([true, false, false]);
    expect(m.loadout).toBeNull();
  });

  it('levels unlock in order', () => {
    const s = newSave();
    expect(isUnlocked(s, '1-1')).toBe(true);
    expect(isUnlocked(s, '1-2')).toBe(false);
    s.levels['1-1'] = { stars: [true, false, false], best: 1, clears: 1 };
    expect(isUnlocked(s, '1-2')).toBe(true);
  });

  it('the workshop charges tier prices and refuses what you can\'t afford', () => {
    const s = newSave();
    expect(buyTier(s, 'stride')).toBe(false);
    s.coins = TIER_PRICES[0] + TIER_PRICES[1];
    expect(buyTier(s, 'stride')).toBe(true);
    expect(buyTier(s, 'stride')).toBe(true);
    expect(s.coins).toBe(0);
    expect(modsOf(s).stride).toBe(2);
    s.coins = 1000;
    expect(buyLoadout(s, 'pistol')).toBe(false);
    s.levels['1-1'] = { stars: [true, false, false], best: 1, clears: 1 };
    expect(buyLoadout(s, 'pistol')).toBe(true);
    expect(modsOf(s).loadout).toBe('pistol');
    expect(buyHolster(s)).toBe(true);
    expect(buyHolster(s)).toBe(false);
  });
});

describe('tally', () => {
  it('pays kills, combos, style, clear, untouched and first-time stars; repeats pay half and no old stars', () => {
    const { w } = botRun(LEVELS[0]);
    const t = tally(w, undefined);
    const s = w.stats;
    const base = s.killCoins + s.comboCoins + s.styleCoins + COINS.clear + COINS.untouched;
    expect(t.total).toBe(base + t.fresh.filter(Boolean).length * COINS.star);
    expect(t.stars[0]).toBe(true);
    const save = newSave();
    applyClear(save, '1-1', t);
    expect(save.coins).toBe(t.total);
    const again = tally(w, record(save, '1-1'));
    expect(again.repeat).toBe(true);
    expect(again.fresh).toEqual([false, false, false]);
    expect(again.total).toBeLessThanOrEqual(Math.ceil(base / 2));
  });
});
