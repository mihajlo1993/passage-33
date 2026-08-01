"use client";

import { SurveyScroller } from "@/src/map/SurveyScroller";
import type { GameState } from "@/src/types";

export interface MapScreenProps {
  state: GameState;
}

export function MapScreen({ state }: MapScreenProps) {
  return (
    <div className="map-screen">
      <SurveyScroller state={state} />
    </div>
  );
}
