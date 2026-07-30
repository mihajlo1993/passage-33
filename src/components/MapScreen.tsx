"use client";

import { SurveyMap } from "@/src/map/SurveyMap";
import type { GameState } from "@/src/types";

export interface MapScreenProps {
  state: GameState;
  onClose: () => void;
}

export function MapScreen({ state, onClose }: MapScreenProps) {
  return (
    <div className="map-screen">
      <SurveyMap state={state} onClose={onClose} />
    </div>
  );
}
