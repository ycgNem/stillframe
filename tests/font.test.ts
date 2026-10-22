import { describe, expect, it } from 'vitest';
import { GLYPHS, GLYPHS7, wrap, textWidth } from '../src/render/font';

describe('pixel fonts', () => {
  it('every 3×5 glyph is five rows of three', () => {
    const bad = Object.entries(GLYPHS).filter(([, g]) => !/^([.#]{3} ){4}[.#]{3}$/.test(g));
    expect(bad).toEqual([]);
  });

  it('every 5×7 glyph is seven rows of five', () => {
    const bad = Object.entries(GLYPHS7).filter(([, g]) => !/^([.#]{5} ){6}[.#]{5}$/.test(g));
    expect(bad).toEqual([]);
  });

  it('both cover the letters and digits', () => {
    const all = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'];
    expect(all.filter((c) => !(c in GLYPHS))).toEqual([]);
    expect(all.filter((c) => !(c in GLYPHS7))).toEqual([]);
  });

  it('wraps text to a width', () => {
    const lines = wrap('STAND STILL TO THINK. EVERY STEP RUNS THE CLOCK.', 80);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(textWidth(l)).toBeLessThanOrEqual(80);
  });
});
