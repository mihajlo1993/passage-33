"use client";

import { itemById } from "@/src/items";
import { TROPHY_PIN_ID, FINAL_PRESENT_PIN_IDS } from "@/src/pins";
import type { PinResolutionResult } from "@/src/game";

export interface ArrivalPanelProps {
  result: PinResolutionResult;
  onContinue: () => void;
}

function continueLabel(result: PinResolutionResult): string {
  if (!result.ok) return "STEP BACK";
  if (result.saveTriggered) return "RECORD TO CASSETTE";
  if (result.gameCompleted) return "LET THE HOUSE GO QUIET";
  if (result.pin.id === TROPHY_PIN_ID) return "VIEW THE TROPHY";
  if ((FINAL_PRESENT_PIN_IDS as readonly number[]).includes(result.pin.id)) {
    return "FIND THE OTHER PRESENT";
  }
  return "KEEP MOVING";
}

/** The one voice through which every pin resolution or refusal is delivered. */
export function ArrivalPanel({ result, onContinue }: ArrivalPanelProps) {
  return (
    <article className="arrival-panel" data-refused={!result.ok} aria-live="assertive">
      <p className="eyebrow">
        {result.ok
          ? "CONTACT ACCEPTED // PIN " + String(result.pin.id).padStart(2, "0")
          : "CONTACT REFUSED"}
      </p>
      <h2>{result.ok ? result.pin.name : "NOT YET."}</h2>
      <p className="host-copy">{result.ok ? result.pin.bodyText : result.hint}</p>
      {result.ok && result.grantedItems.length > 0 && (
        <div className="arrival-grants">
          <span>RECOVERED</span>
          <strong>
            {result.grantedItems.map((id) => itemById[id]?.name ?? id).join(" // ")}
          </strong>
        </div>
      )}
      {result.ok && result.damage > 0 && (
        <p className="system-warning">THE HOUSE TOOK SOMETHING OUT OF YOU.</p>
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
