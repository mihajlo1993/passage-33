"use client";

import { useEffect, useMemo, useState } from "react";
import { colours } from "@/src/tokens";
import { itemById } from "@/src/items";
import type { GameState, Item } from "@/src/types";
import { GameIcon } from "./GameIcon";

function healthWord(health: number): "STEADY" | "HURT" | "BAD" | "CRITICAL" {
  if (health < 40) return "CRITICAL";
  if (health < 60) return "BAD";
  if (health < 80) return "HURT";
  return "STEADY";
}

export interface InventoryScreenProps {
  state: GameState;
  onUseFirstAid: () => boolean;
}

export function InventoryScreen({ state, onUseFirstAid }: InventoryScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const heldItems = useMemo(
    () => state.inventory.map((id) => itemById[id]).filter((item): item is Item => Boolean(item)),
    [state.inventory],
  );
  const selected = selectedId ? itemById[selectedId] : undefined;

  useEffect(() => {
    if (selectedId && !state.inventory.includes(selectedId)) setSelectedId(null);
  }, [selectedId, state.inventory]);

  return (
    <section className="screen inventory-screen" aria-labelledby="inventory-title">
      <header className="screen-heading inventory-heading">
        <div>
          <p className="eyebrow">FIELD CASE</p>
          <h1 id="inventory-title">INVENTORY</h1>
        </div>
        <div className="condition-word" data-critical={state.health < 40}>
          <span>CONDITION</span>
          <strong>{healthWord(state.health)}</strong>
        </div>
      </header>
      {heldItems.length > 0 ? (
        <div className="inventory-grid" aria-label="Held items">
          {heldItems.map((item) => (
            <button
              key={item.id}
              className="inventory-cell"
              data-selected={selectedId === item.id}
              onClick={() => setSelectedId(item.id)}
              aria-label={"Inspect " + item.name}
            >
              <GameIcon name={item.icon} className="inventory-cell__icon" color={colours[item.tint ?? "bone"]} />
              <span>{item.name}</span>
              {item.consumable && <small>ONE USE</small>}
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-case">
          <p>THE CASE IS EMPTY.</p>
          <span>Keep moving. The Host has not finished giving.</span>
        </div>
      )}
      {selected && (
        <aside className="examine-panel" aria-live="polite">
          <div className="examine-panel__object">
            <GameIcon name={selected.icon} className="examine-panel__icon" color={colours[selected.tint ?? "bone"]} />
            <div><p className="eyebrow">EXAMINE</p><h2>{selected.name}</h2></div>
          </div>
          <p className="document-copy">{selected.examine}</p>
          {selected.id === "firstAid" && (
            <button className="mechanical-button mechanical-button--bile" onClick={() => { if (onUseFirstAid()) setSelectedId(null); }}>
              USE FIRST AID
            </button>
          )}
          <button className="text-control" onClick={() => setSelectedId(null)}>CLOSE</button>
        </aside>
      )}
    </section>
  );
}
