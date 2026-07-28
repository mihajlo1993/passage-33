import { createContext, useContext } from "react";
import type { VHSControls } from "./types";

const noopControls: VHSControls = {
  setIntensity: () => undefined,
  glitch: () => undefined,
  dropFrames: () => undefined,
  setTimecode: () => undefined,
};

export const VHSContext = createContext<VHSControls>(noopControls);

export function useVHS(): VHSControls {
  return useContext(VHSContext);
}
