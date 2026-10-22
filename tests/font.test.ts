import { describe, expect, it } from 'vitest';
import { PANE, SHARD } from '../src/ui/fonts';
import { keyWidth, measure, richLines, richWidth, wrap } from '../src/ui/text';

describe('the two faces', () => {
  for (const f of [PANE, SHARD]) {
    it(`${f.name}: every glyph is a rectangle of '.' and '#'`, () => {
      const bad = Object.entries(f.glyphs).filter(([, g]) => {
        const rows = g.split('|');
        return !rows.every((r) => r.length === rows[0].length && /^[.#]+$/.test(r));
      });
      expect(bad.map(([k]) => k)).toEqual([]);
    });

    it(`${f.name}: capitals and figures stand exactly cap-high`, () => {
      const wrong = [...'ABCDEFGHIJKLMNOPRSTUVWXYZ0123456789'].filter((c) => f.glyphs[c].split('|').length !== f.cap);
      expect(wrong).toEqual([]);
    });
  }

  it('Pane has lowercase that sits on the baseline, descenders 2 below', () => {
    for (const c of 'abcdefhiklmnorstuvwxz') expect(PANE.glyphs[c].split('|'), c).toHaveLength(PANE.cap);
    for (const c of 'gjpqy') expect(PANE.glyphs[c].split('|'), c).toHaveLength(PANE.cap + 2);
  });

  it('figures are tabular, so counters do not jitter', () => {
    for (const f of [PANE, SHARD]) {
      const widths = new Set([...'0123456789'].map((c) => f.glyphs[c].split('|')[0].length));
      expect(widths.size, f.name).toBe(1);
    }
  });

  it('measures and wraps', () => {
    expect(measure('A')).toBe(6);
    expect(measure('AA')).toBe(13);
    expect(measure('a b')).toBe(6 + 1 + 4 + 1 + 6);
    const lines = wrap('Stand still to think. Every step runs the clock.', 160);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(160);
  });

  it('rich text: keycaps and icons take their width and wrap as words', () => {
    const one = richLines('[Esc] map');
    expect(one).toHaveLength(1);
    expect(richWidth(one[0])).toBe(keyWidth('Esc') + PANE.space + PANE.gap + measure('map'));
    const many = richLines('[W][A][S][D] move. *Time moves only when you do.*', 120);
    expect(many.length).toBeGreaterThan(1);
    for (const l of many) expect(richWidth(l)).toBeLessThanOrEqual(120);
  });
});
