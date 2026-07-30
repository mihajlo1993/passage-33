"use client";

import { SurveyScroller } from "@/src/map/SurveyScroller";
import type { GameState } from "@/src/types";

export interface MapScreenProps {
  state: GameState;
  onClose: () => void;
}

export function MapScreen({ state, onClose }: MapScreenProps) {
  return (
    <div className="map-screen">
      <SurveyScroller state={state} onClose={onClose} />
    </div>
  );
}
