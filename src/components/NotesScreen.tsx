"use client";

import { useMemo, useState } from "react";
import { itemById } from "@/src/items";
import type { GameState, Item } from "@/src/types";

const DOCUMENT_IDS = new Set(["file01", "file02", "file03", "file04", "development01", "development02", "sixLines"]);

const HOST_ROUTE_DOCUMENT = {
  id: "survey-route",
  name: "SURVEY COVER SHEET",
  examine: "Cadastral Division, file 33. The survey of this address was opened and never closed. The terminal will reopen entries in their original order. The occupant is advised that the house has been counting the interval.",
} as const;

export function NotesScreen({ state }: { state: GameState }) {
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
        <p className="eyebrow">RECOVERED MATERIAL</p>
        <h1 id="notes-title">NOTES</h1>
        <p className="screen-index">{String(documents.length).padStart(2, "0")} DOCUMENTS HELD</p>
      </header>
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
          <div className="paper-document__stamp">RECOVERED</div>
          <p className="paper-document__index">FILE // {selected.id}</p>
          <h2>{selected.name}</h2>
          <p>{selected.examine}</p>
          <footer>DO NOT REMOVE FROM THE HOUSE</footer>
        </article>
      )}
    </section>
  );
}
