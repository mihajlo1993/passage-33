"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The game's structure, always visible: four crimson wax seals in the
 * header, one per lock. A seal is whole until its lock resolves, then it
 * cracks (once, with a small animation at the moment of the resolve) and
 * stays cracked. This row replaces every numeric progress readout.
 */
const LOCK_PINS = [1, 3, 5, 8] as const;
const NUMERALS = ["I", "II", "III", "IV"] as const;

function WaxSeal({ numeral, opened, justCracked }: {
  numeral: string;
  opened: boolean;
  justCracked: boolean;
}) {
  return (
    <svg
      className="wax-seal"
      data-opened={opened}
      data-cracking={justCracked}
      viewBox="0 0 40 40"
      role="img"
      aria-label={opened ? `Lock ${numeral}, opened` : `Lock ${numeral}, sealed`}
    >
      {/* The blob: an uneven pressed-wax disc, never a perfect circle. */}
      <path
        className="wax-seal__wax"
        d="M20 3.5
           C 26 2.5, 33 6, 35.5 12
           C 38 17.5, 37 25, 33 30
           C 29 35.5, 21.5 38, 15 36
           C 8.5 34, 3.5 28, 3.5 21
           C 3.5 13, 11 4.5, 20 3.5 Z"
      />
      {/* The rim of the matrix pressed into the wax. */}
      <circle className="wax-seal__ring" cx="20" cy="20" r="11.5" />
      <text className="wax-seal__numeral" x="20" y="24.5" textAnchor="middle">
        {numeral}
      </text>
      {/* The crack: two meeting fractures across the whole seal. */}
      <g className="wax-seal__crack" aria-hidden="true">
        <path d="M6 12 L14 18 L11 22 L19 26 L17 33" />
        <path d="M33 9 L24 16 L27 20 L19 26 L24 35" />
      </g>
    </svg>
  );
}

export function SealsRow({ resolvedPins }: { resolvedPins: readonly number[] }) {
  const opened = LOCK_PINS.map((pin) => resolvedPins.includes(pin));
  const openedCount = opened.filter(Boolean).length;
  const previousCount = useRef(openedCount);
  const [crackingIndex, setCrackingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openedCount > previousCount.current) {
      const index = openedCount - 1;
      setCrackingIndex(index);
      const timer = window.setTimeout(() => setCrackingIndex(null), 1_400);
      previousCount.current = openedCount;
      return () => window.clearTimeout(timer);
    }
    previousCount.current = openedCount;
  }, [openedCount]);

  return (
    <div className="seals-row" aria-label={`${openedCount} of four locks opened`}>
      {LOCK_PINS.map((pin, index) => (
        <WaxSeal
          key={pin}
          numeral={NUMERALS[index]}
          opened={opened[index]}
          justCracked={crackingIndex === index}
        />
      ))}
    </div>
  );
}
