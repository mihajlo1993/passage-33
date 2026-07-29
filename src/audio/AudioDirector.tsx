"use client";

import { useEffect, useRef } from "react";

import { useGameStore } from "../game";
import { getPinById } from "../pins";
import { useAudio } from "./useAudio";

const PIN_CUES: Readonly<Partial<Record<number, string>>> = {
  21: "candle-light",
  23: "candle-out",
  24: "candle-light",
  25: "fan-stop",
};

const SCARE_CUES = {
  torchKill: "torch-kill",
  roomMonster: "room-monster-arrival",
  closeQuarters: "close-quarters",
} as const;

export function AudioDirector() {
  const audio = useAudio();
  const health = useGameStore((state) => state.health);
  const resolvedPins = useGameStore((state) => state.resolvedPins);
  const lastResolution = useGameStore((state) => state.lastResolution);
  const handledResolution = useRef<unknown>(null);

  useEffect(() => {
    const pinId = resolvedPins.at(-1);
    const zone = pinId === undefined
      ? "corridor"
      : (getPinById(pinId)?.zone ?? "corridor");
    audio.setZone(zone);
    audio.ambient("ambient-" + zone);
  }, [audio, resolvedPins]);

  useEffect(() => {
    audio.heartbeat(health < 20);
    return () => audio.heartbeat(false);
  }, [audio, health]);

  useEffect(() => {
    if (lastResolution === handledResolution.current) return;
    handledResolution.current = lastResolution;
    if (lastResolution === null) return;

    void audio.play("ui-contact");
    if (!lastResolution.ok) {
      void audio.play("ui-refused");
      return;
    }

    const { pin } = lastResolution;
    void audio.play("ui-found");
    void audio.say("voice-pin-" + String(pin.id).padStart(2, "0"));

    if (pin.scare && pin.scare !== "roomMonster") {
      void audio.play(SCARE_CUES[pin.scare]);
    }
    const pinCue = PIN_CUES[pin.id];
    if (pinCue) void audio.play(pinCue);
    if (lastResolution.saveTriggered) void audio.play("save-deck");
    if (lastResolution.finished) void audio.play("trophy-resolve");
  }, [audio, lastResolution]);

  return null;
}
