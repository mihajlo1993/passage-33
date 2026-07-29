"use client";

import { useEffect, useRef } from "react";

import { useGameStore } from "../game";
import { getPinById } from "../pins";
import { useAudio } from "./useAudio";
import {
  readPlayedVoiceIds,
  VOICE_CUES_BY_PIN,
  writePlayedVoiceIds,
} from "./voiceCues";

const DEAD_BED_PINS = new Set([12, 26]);
const SCARE_CUES = {
  torchKill: "stinger-a",
  roomMonster: "stinger-b",
  closeQuarters: "stinger-c",
} as const;

const STINGERS: Readonly<Partial<Record<number, "stinger-a" | "stinger-b" | "stinger-c">>> = {
  9: "stinger-a",
  18: "stinger-b",
  22: "stinger-c",
};

export function healthToBedTension(health: number): number {
  if (!Number.isFinite(health)) return 0;
  return Math.min(1, Math.max(0, (100 - health) / 80));
}

export function AudioDirector() {
  const audio = useAudio();
  const health = useGameStore((state) => state.health);
  const resolvedPins = useGameStore((state) => state.resolvedPins);
  const lastResolution = useGameStore((state) => state.lastResolution);
  const handledResolution = useRef<unknown>(null);
  const playedVoices = useRef<Set<string> | null>(null);
  const delayedStingers = useRef<Set<number>>(new Set());

  useEffect(() => {
    const pinId = resolvedPins.at(-1);
    const zone = pinId === undefined
      ? "corridor"
      : (getPinById(pinId)?.zone ?? "corridor");
    audio.setZone(zone);
    if (pinId !== undefined && DEAD_BED_PINS.has(pinId)) audio.ambient("dead");
  }, [audio, resolvedPins]);

  useEffect(() => {
    audio.setBedTension(healthToBedTension(health));
    audio.heartbeat(health < 40);
    return () => audio.heartbeat(false);
  }, [audio, health]);

  useEffect(() => () => {
    for (const timer of delayedStingers.current) window.clearTimeout(timer);
    delayedStingers.current.clear();
  }, []);

  useEffect(() => {
    if (lastResolution === handledResolution.current) return;
    handledResolution.current = lastResolution;
    if (lastResolution === null) return;

    if (!lastResolution.ok) {
      void audio.play("refused");
      return;
    }

    const { pin } = lastResolution;
    if (lastResolution.grantedItems.length > 0) void audio.play("found");
    if (pin.resolution === "dial") void audio.play("released");
    if (lastResolution.saveTriggered) void audio.play("write");

    if (pin.scare && pin.scare !== "roomMonster") {
      if (STINGERS[pin.id] === undefined) void audio.play(SCARE_CUES[pin.scare]);
    }

    const voiceId = VOICE_CUES_BY_PIN[pin.id];
    if (voiceId !== undefined) {
      playedVoices.current ??= readPlayedVoiceIds(window.localStorage);
      if (!playedVoices.current.has(voiceId)) {
        playedVoices.current.add(voiceId);
        writePlayedVoiceIds(window.localStorage, playedVoices.current);
        void audio.say(voiceId);
      }
    }

    const stinger = STINGERS[pin.id];
    if (stinger === undefined) return;
    if (stinger === "stinger-a") {
      void audio.play(stinger);
      return;
    }

    // The friction begins first; the impact is deliberately 800 ms later.
    void audio.play("drag");
    const timer = window.setTimeout(() => {
      delayedStingers.current.delete(timer);
      void audio.play(stinger);
    }, 800);
    delayedStingers.current.add(timer);
  }, [audio, lastResolution]);

  return null;
}
