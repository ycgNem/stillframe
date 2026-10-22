// The one palette (docs/STYLE.md). Every sprite is snapped to it and code draws only with these names.
// pixel-art/common/sf.py reads the same JSON, so the art scripts and the game can't drift apart.
import PALETTE_JSON from './palette.json';

export type ColorName = keyof typeof PALETTE_JSON;
export const PAL: Readonly<Record<ColorName, string>> = PALETTE_JSON;
