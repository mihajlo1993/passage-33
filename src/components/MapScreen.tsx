"use client";

import { SurveyMap } from "@/src/map/SurveyMap";
import type { GameState } from "@/src/types";

export function MapScreen({ state }: { state: GameState }) {
  return (
    <section className="screen map-screen" aria-labelledby="map-title">
      <header className="screen-heading">
        <p className="eyebrow">SURVEY // FLAT 33</p>
        <h1 id="map-title">THE FLOORPLAN</h1>
        <p className="screen-index">
          ROOM SHADING RECORDS HOW FAR YOU HAVE SEARCHED
        </p>
      </header>

      <SurveyMap state={state} />

      <p className="map-gesture-note">
        SPREAD TO INSPECT // DRAG TO PAN // DOUBLE-TAP TO RESET
      </p>

      <div className="map-state-key" aria-label="Room state key">
        <span>
          <i className="map-state-key__swatch map-state-key__swatch--active" />
          UNRESOLVED
        </span>
        <span>
          <i className="map-state-key__swatch map-state-key__swatch--clear" />
          CLEARED
        </span>
        <span>
          <i className="map-state-key__swatch map-state-key__swatch--unseen" />
          UNENTERED
        </span>
      </div>

      <p className="host-copy host-copy--compact">
        The front door stays shut. Do not take it personally. The house has
        arranged a route, and birthday guests who follow the route receive much
        better presents.
      </p>
    </section>
  );
}
