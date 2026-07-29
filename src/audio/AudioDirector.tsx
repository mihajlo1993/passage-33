"use client";

import { useEffect, useMemo, useRef } from "react";

import { useHaptics } from "../device";
import { Phase2IntegrationCoordinator, useGameStore } from "../game";
import { useAudio } from "./useAudio";

export function AudioDirector() {
  const audio = useAudio();
  const health = useGameStore((state) => state.health);
  const resolvedPins = useGameStore((state) => state.resolvedPins);
  const lastResolution = useGameStore((state) => state.lastResolution);
  const handledResolution = useRef<unknown>(null);
  const haptics = useHaptics();
  const coordinator = useMemo(
    () => new Phase2IntegrationCoordinator({ audio, haptics }),
    [audio, haptics],
  );

  useEffect(() => {
    coordinator.syncZoneFromResolvedPins(resolvedPins);
  }, [coordinator, resolvedPins]);

  useEffect(() => {
    coordinator.syncHealth(health);
    return () => coordinator.stopSession();
  }, [coordinator, health]);

  useEffect(() => {
    if (lastResolution === handledResolution.current) return;
    handledResolution.current = lastResolution;
    if (lastResolution === null) return;

    coordinator.handleResolution(lastResolution);
  }, [coordinator, lastResolution]);

  return null;
}
