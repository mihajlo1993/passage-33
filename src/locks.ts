export type DialLockKind = "numeric" | "alpha";
export type DialDirection = -1 | 1;

export const NUMERIC_DIAL_SYMBOLS = Object.freeze(
  Array.from({ length: 10 }, (_, index) => String(index)),
);

export const ALPHA_DIAL_SYMBOLS = Object.freeze(
  Array.from({ length: 26 }, (_, index) =>
    String.fromCharCode("A".charCodeAt(0) + index),
  ),
);

export const DIAL_LENGTHS: Readonly<Record<DialLockKind, number>> = {
  numeric: 3,
  alpha: 5,
};

export function symbolsForDial(kind: DialLockKind): readonly string[] {
  return kind === "numeric" ? NUMERIC_DIAL_SYMBOLS : ALPHA_DIAL_SYMBOLS;
}

export function normaliseDialCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidDialCode(value: string, kind: DialLockKind): boolean {
  const normalised = normaliseDialCode(value);
  const symbols = symbolsForDial(kind);
  return (
    normalised.length === DIAL_LENGTHS[kind] &&
    Array.from(normalised).every((symbol) => symbols.includes(symbol))
  );
}

export function createDialValue(kind: DialLockKind): readonly string[] {
  const firstSymbol = symbolsForDial(kind)[0];
  return Object.freeze(
    Array.from({ length: DIAL_LENGTHS[kind] }, () => firstSymbol),
  );
}

export function rotateDialSymbol(
  current: string,
  direction: DialDirection,
  symbols: readonly string[],
): string {
  if (symbols.length === 0) {
    return current;
  }

  const currentIndex = symbols.indexOf(current);
  const startIndex = currentIndex < 0 ? 0 : currentIndex;
  const nextIndex = (startIndex + direction + symbols.length) % symbols.length;
  return symbols[nextIndex];
}

export function rotateDialAt(
  current: readonly string[],
  position: number,
  direction: DialDirection,
  symbols: readonly string[],
): readonly string[] {
  if (!Number.isInteger(position) || position < 0 || position >= current.length) {
    return current;
  }

  return current.map((symbol, index) =>
    index === position
      ? rotateDialSymbol(symbol, direction, symbols)
      : symbol,
  );
}

export function dialValue(current: readonly string[]): string {
  return current.join("");
}

export function dialCodeMatches(
  current: readonly string[] | string,
  expected: string,
): boolean {
  const candidate = typeof current === "string" ? current : dialValue(current);
  return normaliseDialCode(candidate) === normaliseDialCode(expected);
}
