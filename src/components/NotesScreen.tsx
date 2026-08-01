"use client";

import { useMemo, useState } from "react";
import { itemById } from "@/src/items";
import { CINEMA_POSTER_PATH } from "@/src/cinema";
import { playKeeper, unlockKeeper } from "@/src/audio/keeper";
import type { GameState, Item } from "@/src/types";

const DOCUMENT_IDS = new Set(["fragment01", "fragment02", "fragment03", "fragment04"]);

const HOST_ROUTE_DOCUMENT = {
  id: "survey-route",
  name: "THE KEEPER'S NOTE",
  examine: "Four locks, four gifts, one letter in quarters. The Keeper sealed them the night you were born and has kept the count ever since. Open the locks in order; the letter assembles itself.",
} as const;

export function NotesScreen({ state, navigate }: {
  state: GameState;
  navigate: (path: string) => void;
}) {
  const documents = useMemo(
    () => [
      HOST_ROUTE_DOCUMENT,
      ...state.inventory
        .filter((id) => DOCUMENT_IDS.has(id))
        .map((id) => itemById[id])
        .filter((item): item is Item => Boolean(item)),
    ],
    [state.inventory],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = (selectedId && documents.find((item) => item.id === selectedId)) || documents[0];

  return (
    <section className="screen notes-screen" aria-labelledby="notes-title">
      <header className="screen-heading">
        <p className="eyebrow">RELEASED FROM TRUST</p>
        <h1 id="notes-title">THE LETTER</h1>
        <p className="screen-index">{String(documents.length).padStart(2, "0")} PAPERS HELD</p>
      </header>
      {state.finishedAt !== null && (
        <button
          className="chronicle-card"
          onClick={() => {
            // Replay the film with the narration, from the first word.
            unlockKeeper();
            void playKeeper("lock4", { restart: true });
            navigate("/trophy");
          }}
        >
          <img className="chronicle-card__poster" src={CINEMA_POSTER_PATH} alt="" aria-hidden="true" />
          <span className="chronicle-card__title">The Letter, whole</span>
          <span className="microcopy">Hear the Keeper read it again</span>
        </button>
      )}
      <div className="document-tabs" role="list" aria-label="Collected documents">
        {documents.map((document, index) => (
          <button
            key={document.id}
            role="listitem"
            className="document-tab"
            data-selected={selected?.id === document.id}
            onClick={() => setSelectedId(document.id)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>{document.name}
          </button>
        ))}
      </div>
      {selected && (
        <article className="paper-document" aria-live="polite">
          <div className="paper-document__stamp">RELEASED</div>
          <p className="paper-document__index">
            {"PAPER " + String(documents.findIndex((paper) => paper.id === selected.id) + 1).padStart(2, "0") + " OF " + String(documents.length).padStart(2, "0") + " · THE KEEPER'S LEDGER"}
          </p>
          <h2>{selected.name}</h2>
          <p>{selected.examine}</p>
          <footer>HELD IN TRUST · THIRTY-THREE YEARS</footer>
        </article>
      )}
    </section>
  );
}
