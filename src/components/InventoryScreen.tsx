"use client";

import { useEffect, useMemo, useState } from "react";
import { colours } from "@/src/tokens";
import { itemById } from "@/src/items";
import { MEDIA_ASSETS } from "@/src/media";
import { getItemModel } from "@/src/models/manifest";
import type { GameState, Item } from "@/src/types";
import { EcgPanel } from "./EcgPanel";
import { ExamineModel } from "./ExamineModel";
import { GameIcon } from "./GameIcon";

function thumbUrl(item: Item): string | null {
  if (!item.thumb) return null;
  const record = (MEDIA_ASSETS as Record<string, { webp?: { url: string } | null } | undefined>)[
    item.thumb
  ];
  return record?.webp?.url ?? null;
}

/**
 * The custody grid. Four columns of plates on a true-black slab; filled
 * plates are warm grey with the item render sitting on them, the selected
 * plate inverts to bone with a glow. Twelve slots because the file has
 * twelve entries worth keeping at once.
 */
const GRID_SLOTS = 12;

export interface InventoryScreenProps {
  state: GameState;
}

export function InventoryScreen({ state }: InventoryScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspecting3d, setInspecting3d] = useState(false);
  const [brokenModels, setBrokenModels] = useState<ReadonlySet<string>>(new Set());
  const heldItems = useMemo(
    () => state.inventory.map((id) => itemById[id]).filter((item): item is Item => Boolean(item)),
    [state.inventory],
  );
  const selected = selectedId ? itemById[selectedId] : undefined;
  const selectedModel =
    selected && !brokenModels.has(selected.id) ? getItemModel(selected.id) : undefined;

  useEffect(() => {
    if (selectedId && !state.inventory.includes(selectedId)) setSelectedId(null);
  }, [selectedId, state.inventory]);

  useEffect(() => {
    setInspecting3d(false);
  }, [selectedId]);

  if (selected && selectedModel && inspecting3d) {
    return (
      <ExamineModel
        itemName={selected.name}
        model={selectedModel}
        onClose={() => setInspecting3d(false)}
        onUnavailable={() => {
          setBrokenModels((current) => new Set(current).add(selected.id));
          setInspecting3d(false);
        }}
      />
    );
  }

  const emptySlots = Math.max(0, GRID_SLOTS - heldItems.length);

  return (
    <section className="screen inventory-screen" aria-labelledby="inventory-title">
      <header className="screen-heading inventory-heading">
        <div>
          <p className="eyebrow">Held in trust</p>
          <h1 id="inventory-title">The gifts</h1>
        </div>
      </header>

      <div className="re-inventory-grid re-frame" aria-label="Held items">
        {heldItems.map((item) => {
          const thumb = thumbUrl(item);
          return (
            <button
              key={item.id}
              className="re-cell"
              data-selected={selectedId === item.id}
              onClick={() => setSelectedId(item.id)}
              aria-label={"Inspect " + item.name}
            >
              {thumb ? (
                <img className="re-cell__render" src={thumb} alt="" aria-hidden="true" />
              ) : (
                <GameIcon
                  name={item.icon}
                  className="re-cell__icon"
                  color={selectedId === item.id ? colours.ink : colours.ink}
                />
              )}
            </button>
          );
        })}
        {Array.from({ length: emptySlots }, (_, index) => (
          <span key={"empty-" + index} className="re-cell re-cell--empty" aria-hidden="true" />
        ))}
      </div>

      {selected ? (
        <aside className="re-detail" aria-live="polite">
          <h2 className="re-detail__name">{selected.name}</h2>
          <p className="re-detail__body">{selected.examine}</p>
          <div className="re-verbs" role="group" aria-label="Item actions">
            {selectedModel && (
              <button className="re-verb" onClick={() => setInspecting3d(true)}>
                Examine
              </button>
            )}
            <button className="re-verb" onClick={() => setSelectedId(null)}>
              Close
            </button>
          </div>
        </aside>
      ) : (
        <p className="re-detail__hint">Choose a thing the Keeper kept, and examine it.</p>
      )}

      <EcgPanel health={state.health} />
    </section>
  );
}
