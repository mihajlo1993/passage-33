"use client";

import type { CSSProperties } from "react";
import { pins } from "@/src/pins";
import type { GameState } from "@/src/types";
import { mapLandmarks, zoneConnections, zones } from "@/src/zones";

export function MapScreen({ state }: { state: GameState }) {
  const resolved = new Set(state.resolvedPins);
  return (
    <section className="screen map-screen" aria-labelledby="map-title">
      <header className="screen-heading">
        <p className="eyebrow">SURVEY // FLAT 33</p>
        <h1 id="map-title">THE FLOORPLAN</h1>
        <p className="screen-index">BLUE CLEARED // RED UNRESOLVED</p>
      </header>
      <div className="floorplan" aria-label="Map of the flat">
        {zones.map((zone) => {
          const remaining = pins.filter((pin) => pin.zone === zone.id && !resolved.has(pin.id)).length;
          const cleared = state.clearedZones.includes(zone.id);
          const style = {
            gridColumn: zone.grid.column + " / span " + zone.grid.columnSpan,
            gridRow: zone.grid.row + " / span " + zone.grid.rowSpan,
          } as CSSProperties;
          return (
            <div
              key={zone.id}
              className="zone-block"
              data-cleared={cleared}
              data-zone={zone.id}
              style={style}
              aria-label={zone.name + ", " + (cleared ? "cleared" : remaining + " unresolved contacts")}
            >
              <span className="zone-block__name">{zone.name}</span>
              <span className="zone-block__count">{cleared ? "CLEAR" : String(remaining).padStart(2, "0")}</span>
              {mapLandmarks.start.zone === zone.id && <span className="map-landmark map-landmark--start">START</span>}
              {mapLandmarks.frontDoor.zone === zone.id && <span className="map-landmark map-landmark--door">FRONT DOOR // SEALED</span>}
            </div>
          );
        })}
        <span className="map-door map-door--bathroom" aria-hidden="true" />
        <span className="map-door map-door--kitchen" aria-hidden="true" />
        <span className="map-door map-door--balcony" data-locked={!resolved.has(16)} aria-hidden="true" />
      </div>
      <div className="map-legend">
        {zoneConnections.map((connection) => (
          <div key={connection.zones.join("-")} className="legend-row">
            <span>{connection.zones.join(" / ")}</span>
            <span>
              {connection.passage}
              {connection.lockedUntilPin && !resolved.has(connection.lockedUntilPin) ? " // PADLOCKED" : ""}
            </span>
          </div>
        ))}
      </div>
      <p className="host-copy host-copy--compact">
        The front door stays shut. Do not take it personally. The house has arranged a route, and birthday guests who follow the route receive much better presents.
      </p>
    </section>
  );
}
