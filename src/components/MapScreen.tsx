"use client";

import { SurveyMap } from "@/src/map/SurveyMap";
import type { GameState } from "@/src/types";

export function MapScreen({ state }: { state: GameState }) {
  return (
    <section className="map-screen" aria-label="Flat survey">
      <SurveyMap state={state} />
    </section>
  );
}
