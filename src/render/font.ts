// Two pixel fonts drawn from glyph strings: a 3×5 for the HUD and small print, a 5×7 for headings and
// buttons. '#' = a pixel. Uppercase only: lowercase draws as uppercase; unknown characters draw as '?'.

export const GLYPHS: Record<string, string> = {
  A: '.#. #.# ### #.# #.#', B: '##. #.# ##. #.# ##.', C: '.## #.. #.. #.. .##', D: '##. #.# #.# #.# ##.',
  E: '### #.. ##. #.. ###', F: '### #.. ##. #.. #..', G: '.## #.. #.# #.# .##', H: '#.# #.# ### #.# #.#',
  I: '### .#. .#. .#. ###', J: '..# ..# ..# #.# .#.', K: '#.# #.# ##. #.# #.#', L: '#.. #.. #.. #.. ###',
  M: '#.# ### ### #.# #.#', N: '##. #.# #.# #.# #.#', O: '.#. #.# #.# #.# .#.', P: '##. #.# ##. #.. #..',
  Q: '.#. #.# #.# ##. .##', R: '##. #.# ##. #.# #.#', S: '.## #.. .#. ..# ##.', T: '### .#. .#. .#. .#.',
  U: '#.# #.# #.# #.# ###', V: '#.# #.# #.# #.# .#.', W: '#.# #.# ### ### #.#', X: '#.# #.# .#. #.# #.#',
  Y: '#.# #.# .#. .#. .#.', Z: '### ..# .#. #.. ###',
  0: '### #.# #.# #.# ###', 1: '.#. ##. .#. .#. ###', 2: '##. ..# .#. #.. ###', 3: '##. ..# .#. ..# ##.',
  4: '#.# #.# ### ..# ..#', 5: '### #.. ##. ..# ##.', 6: '.## #.. ### #.# ###', 7: '### ..# .#. .#. .#.',
  8: '### #.# ### #.# ###', 9: '### #.# ### ..# ##.',
  '.': '... ... ... ... .#.', ',': '... ... ... .#. #..', ':': '... .#. ... .#. ...', '!': '.#. .#. .#. ... .#.',
  '?': '##. ..# .#. ... .#.', '-': '... ... ### ... ...', '+': '... .#. ### .#. ...', '/': '..# ..# .#. #.. #..',
  "'": '.#. .#. ... ... ...', '%': '#.. ..# .#. #.. ..#', '(': '.#. #.. #.. #.. .#.', ')': '.#. ..# ..# ..# .#.',
  '>': '#.. .#. ..# .#. #..', '<': '..# .#. #.. .#. ..#', '=': '... ### ... ### ...', '*': '... #.# .#. #.# ...',
  '#': '#.# ### #.# ### #.#', ' ': '... ... ... ... ...',
};

export const GLYPHS7: Record<string, string> = {
  A: '.###. #...# #...# ##### #...# #...# #...#', B: '####. #...# #...# ####. #...# #...# ####.',
  C: '.###. #...# #.... #.... #.... #...# .###.', D: '####. #...# #...# #...# #...# #...# ####.',
  E: '##### #.... #.... ####. #.... #.... #####', F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .####', H: '#...# #...# #...# ##### #...# #...# #...#',
  I: '##### ..#.. ..#.. ..#.. ..#.. ..#.. #####', J: '..### ...#. ...#. ...#. #..#. #..#. .##..',
  K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#', L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#', N: '#...# ##..# #.#.# #..## #...# #...# #...#',
  O: '.###. #...# #...# #...# #...# #...# .###.', P: '####. #...# #...# ####. #.... #.... #....',
  Q: '.###. #...# #...# #...# #.#.# #..#. .##.#', R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.#### #.... #.... .###. ....# ....# ####.', T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# .###.', V: '#...# #...# #...# #...# #...# .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.', X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..', Z: '##### ....# ...#. ..#.. .#... #.... #####',
  0: '.###. #...# #..## #.#.# ##..# #...# .###.', 1: '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
  2: '.###. #...# ....# ...#. ..#.. .#... #####', 3: '####. ....# ....# .###. ....# ....# ####.',
  4: '...#. ..##. .#.#. #..#. ##### ...#. ...#.', 5: '##### #.... ####. ....# ....# #...# .###.',
  6: '.###. #.... #.... ####. #...# #...# .###.', 7: '##### ....# ...#. ..#.. .#... .#... .#...',
  8: '.###. #...# #...# .###. #...# #...# .###.', 9: '.###. #...# #...# .#### ....# ....# .###.',
  '.': '..... ..... ..... ..... ..... .##.. .##..', ',': '..... ..... ..... ..... .##.. ..#.. .#...',
  ':': '..... .##.. .##.. ..... .##.. .##.. .....', '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..',
  '?': '.###. #...# ....# ...#. ..#.. ..... ..#..', '-': '..... ..... ..... .###. ..... ..... .....',
  '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....', '/': '....# ....# ...#. ..#.. .#... #.... #....',
  "'": '..#.. ..#.. .#... ..... ..... ..... .....', '%': '##..# ##..# ...#. ..#.. .#... #..## #..##',
  '(': '...#. ..#.. .#... .#... .#... ..#.. ...#.', ')': '.#... ..#.. ...#. ...#. ...#. ..#.. .#...',
  '>': '.#... ..#.. ...#. ....# ...#. ..#.. .#...', '<': '...#. ..#.. .#... #.... .#... ..#.. ...#.',
  ' ': '..... ..... ..... ..... ..... ..... .....',
};

/** Pixels from one glyph's left edge to the next. */
export const ADVANCE = 4;
export const ADVANCE7 = 6;

const BITS: Record<string, string> = Object.fromEntries(Object.entries(GLYPHS).map(([k, g]) => [k, g.replace(/ /g, '')]));
const BITS7: Record<string, string> = Object.fromEntries(Object.entries(GLYPHS7).map(([k, g]) => [k, g.replace(/ /g, '')]));

export function textWidth(text: string, scale = 1) {
  return text.length ? (text.length * ADVANCE - 1) * scale : 0;
}

export function bigWidth(text: string, scale = 1) {
  return text.length ? (text.length * ADVANCE7 - 1) * scale : 0;
}

function drawGlyphs(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale: number, big: boolean) {
  ctx.fillStyle = color;
  const up = text.toUpperCase();
  const [w, h, adv, bits] = big ? [5, 7, ADVANCE7, BITS7] : [3, 5, ADVANCE, BITS];
  const x0 = Math.round(x), y0 = Math.round(y);
  for (let i = 0; i < up.length; i++) {
    const g = bits[up[i]] ?? bits['?'];
    for (let p = 0; p < w * h; p++) {
      if (g[p] !== '#') continue;
      ctx.fillRect(x0 + (i * adv + (p % w)) * scale, y0 + Math.floor(p / w) * scale, scale, scale);
    }
  }
}

/** 3×5 text with its top-left at (x, y), each font pixel `scale` game pixels. Returns the width. */
export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale = 1) {
  drawGlyphs(ctx, text, x, y, color, scale, false);
  return textWidth(text, scale);
}

/** 5×7 text. Returns the width. */
export function drawBig(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale = 1) {
  drawGlyphs(ctx, text, x, y, color, scale, true);
  return bigWidth(text, scale);
}

/** Text with a 1 px outline all round, so it reads on any floor. */
export function drawOutlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, outline: string, big = false, scale = 1) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) drawGlyphs(ctx, text, x + dx, y + dy, outline, scale, big);
  drawGlyphs(ctx, text, x, y, color, scale, big);
}

export function centerText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, color: string, scale = 1) {
  drawText(ctx, text, Math.round(cx - textWidth(text, scale) / 2), y, color, scale);
}

export function centerBig(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, color: string, scale = 1) {
  drawBig(ctx, text, Math.round(cx - bigWidth(text, scale) / 2), y, color, scale);
}

/** Splits text into lines no wider than `maxW` pixels in the 3×5 font. */
export function wrap(text: string, maxW: number): string[] {
  const words = text.split(' '), out: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (textWidth(next) > maxW && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}
