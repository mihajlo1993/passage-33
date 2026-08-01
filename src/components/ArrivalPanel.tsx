"use client";

import { itemById } from "@/src/items";
import type { PinResolutionResult } from "@/src/game";

export interface ArrivalPanelProps {
  result: PinResolutionResult;
  onContinue: () => void;
}

const ENTRY_NUMERALS = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"] as const;

function continueLabel(result: PinResolutionResult): string {
  if (!result.ok) return "STEP AWAY";
  if (result.pin.kind === "win" || result.gameCompleted) return "OPEN THE LETTER";
  return "BACK TO THE LEDGER";
}

/** The one voice through which every pin resolution or refusal is delivered. */
export function ArrivalPanel({ result, onContinue }: ArrivalPanelProps) {
  return (
    <article className="arrival-panel" data-refused={!result.ok} aria-live="assertive">
      <p className="eyebrow">
        {result.ok
          ? "ENTRY " + (ENTRY_NUMERALS[result.pin.id] ?? String(result.pin.id)) + " · RECORDED"
          : "DECLINED"}
      </p>
      <h2>{result.ok ? result.pin.name : "Not yet."}</h2>
      <p className="host-copy">{result.ok ? result.pin.bodyText : result.hint}</p>
      {result.ok && result.grantedItems.length > 0 && (
        <div className="arrival-grants">
          <span>RELEASED FROM TRUST</span>
          <strong>
            {result.grantedItems.map((id) => itemById[id]?.name ?? id).join(" · ")}
          </strong>
        </div>
      )}
      {result.ok && result.damage > 0 && (
        <p className="system-warning">THE DARK TOOK SOMETHING OUT OF YOU. IT ALWAYS GIVES IT BACK.</p>
      )}
      <button
        className="mechanical-button mechanical-button--primary mechanical-button--full"
        onClick={onContinue}
      >
        {continueLabel(result)}
      </button>
    </article>
  );
}
