export const KALLAX_GLYPH_COUNT = 16;

/** SETUP CONSTANT: tape the blue keycard in the cell carrying this glyph. */
export const KALLAX_KEY_GLYPH_INDEX = 11;

export interface KallaxGlyph {
  index: number;
  icon: string;
}

export function kallaxGlyphIcon(index: number): string {
  return `abstract-${String(index).padStart(3, "0")}`;
}

export const kallaxGlyphs: readonly KallaxGlyph[] = Array.from(
  { length: KALLAX_GLYPH_COUNT },
  (_, offset) => {
    const index = offset + 1;
    return { index, icon: kallaxGlyphIcon(index) };
  },
);

export const kallaxKeyGlyph = kallaxGlyphs[KALLAX_KEY_GLYPH_INDEX - 1];
