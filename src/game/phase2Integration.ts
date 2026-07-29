import { getVHSHealthProfile, type VHSHealthProfile } from "../fx";
import { itemIds } from "../items";
import { getPinById } from "../pins";
import { motion } from "../tokens";
import type { GameState, Pin, ZoneId } from "../types";
import type { PinResolutionResult } from "./engine";

export const PHASE2_SCARE_PIN_IDS = [9, 18, 22] as const;
export const IMAGE_AR_PIN_IDS = [3, 17] as const;
export const ROOM_AR_PIN_ID = 18;
export const FIELD_DESK_PIN_ID = 15;

export type Phase2ArRoute = "image" | "room" | null;
export type Phase2HapticCue = "contact" | "found" | "stutter";

const PIN_AUDIO_CUES: Readonly<Partial<Record<number, string>>> = {
  21: "candle-light",
  23: "candle-out",
  24: "candle-light",
  25: "fan-stop",
};

const SCARE_AUDIO_CUES = {
  torchKill: "torch-kill",
  roomMonster: "room-monster-arrival",
  closeQuarters: "close-quarters",
} as const;

export const SAVE_WRITTEN_AUDIO_CUE = "save-deck";
export const DIAL_WRONG_AUDIO_CUE = "ui-refused";
export const DIAL_CORRECT_AUDIO_CUE = "ui-found";

export interface Phase2AudioPort {
  setZone(zone: ZoneId): void;
  ambient(id: string | null): void;
  play(id: string): void | Promise<void>;
  say?(id: string): void | Promise<void>;
  heartbeat(enabled: boolean): void;
}

export interface Phase2VHSPort {
  setIntensity(intensity: number): void;
  setTimecode(timecode: string | null): void;
  glitch(durationMs: number): void;
  dropFrames(durationMs: number): void;
}

export interface Phase2HapticsPort {
  contact(): unknown;
  found(): unknown;
  stutter(): unknown;
  heartbeat(enabled: boolean): void;
}

export interface Phase2WakeLockPort {
  acquire(): void | Promise<unknown>;
  release(): void | Promise<unknown>;
}

export interface Phase2TorchPort {
  on(): void | Promise<unknown>;
  off(): void | Promise<unknown>;
}

export interface Phase2IntegrationPorts {
  readonly audio?: Phase2AudioPort;
  readonly vhs?: Phase2VHSPort;
  readonly haptics?: Phase2HapticsPort;
  readonly wakeLock?: Phase2WakeLockPort;
  readonly torch?: Phase2TorchPort;
}

function runEffect(effect: () => void | Promise<unknown>): void {
  try {
    void Promise.resolve(effect()).catch(() => undefined);
  } catch {
    // Hardware and playback effects are best effort and cannot block game state.
  }
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function phase2ArRouteForPin(pinId: number): Phase2ArRoute {
  if ((IMAGE_AR_PIN_IDS as readonly number[]).includes(pinId)) return "image";
  return pinId === ROOM_AR_PIN_ID ? "room" : null;
}

export function canResolveRoomAr(
  state: Pick<GameState, "inventory">,
  shotFired: boolean,
): boolean {
  return shotFired && state.inventory.includes(itemIds.pistol);
}

export function phase2AudioCuesForResolution(
  result: PinResolutionResult,
): readonly string[] {
  if (!result.ok) return ["ui-refused"];

  const cues: string[] = ["ui-contact"];
  if (
    result.grantedItems.length > 0
    || result.pin.resolution === "dial"
  ) {
    cues.push("ui-found");
  }

  if (result.pin.scare && result.pin.scare !== "roomMonster") {
    cues.push(SCARE_AUDIO_CUES[result.pin.scare]);
  }
  const pinCue = PIN_AUDIO_CUES[result.pin.id];
  if (pinCue) cues.push(pinCue);
  if (result.finished) cues.push("trophy-resolve");
  return unique(cues);
}

export function phase2HapticCuesForResolution(
  result: PinResolutionResult,
): readonly Phase2HapticCue[] {
  if (!result.ok) return [];

  const cues: Phase2HapticCue[] = [];
  if ((PHASE2_SCARE_PIN_IDS as readonly number[]).includes(result.pin.id)) {
    cues.push("contact");
  }
  if (result.grantedItems.length > 0) cues.push("found");
  if (result.pin.scare === "torchKill") cues.push("stutter");
  return cues;
}

export function phase2DialAudioCue(correct: boolean): string {
  return correct ? DIAL_CORRECT_AUDIO_CUE : DIAL_WRONG_AUDIO_CUE;
}

export function phase2HealthProfile(health: number): VHSHealthProfile {
  return getVHSHealthProfile(health);
}

function latestResolvedZone(resolvedPins: readonly number[]): ZoneId {
  const pinId = resolvedPins.at(-1);
  return pinId === undefined ? "corridor" : (getPinById(pinId)?.zone ?? "corridor");
}

export class Phase2IntegrationCoordinator {
  private currentZone: ZoneId | null = null;
  private heartbeatEnabled: boolean | null = null;

  public constructor(private readonly ports: Phase2IntegrationPorts) {}

  public startSession(): void {
    if (this.ports.wakeLock) {
      runEffect(() => this.ports.wakeLock!.acquire());
    }
  }

  public stopSession(): void {
    this.setHeartbeat(false);
    if (this.ports.wakeLock) {
      runEffect(() => this.ports.wakeLock!.release());
    }
  }

  public syncZoneFromResolvedPins(resolvedPins: readonly number[]): ZoneId {
    return this.syncZone(latestResolvedZone(resolvedPins));
  }

  public syncZone(zone: ZoneId): ZoneId {
    if (zone === this.currentZone) return zone;
    this.currentZone = zone;
    this.ports.audio?.setZone(zone);
    this.ports.audio?.ambient("ambient-" + zone);
    return zone;
  }

  public syncHealth(health: number): VHSHealthProfile {
    const profile = phase2HealthProfile(health);
    this.ports.vhs?.setIntensity(profile.intensity);
    this.ports.vhs?.setTimecode(
      profile.unstableTimecode ? "REC --:--:--" : null,
    );
    if (profile.periodicDropFrames) {
      this.ports.vhs?.dropFrames(motion.eventMs.vhsCriticalDrop);
    }
    this.setHeartbeat(health < 40);
    return profile;
  }

  public handleResolution(result: PinResolutionResult): void {
    if (result.ok) this.syncZone(result.pin.zone);

    for (const cue of phase2AudioCuesForResolution(result)) {
      if (this.ports.audio) {
        runEffect(() => this.ports.audio!.play(cue));
      }
    }
    if (result.ok && this.ports.audio?.say) {
      const voiceId = "voice-pin-" + String(result.pin.id).padStart(2, "0");
      runEffect(() => this.ports.audio!.say!(voiceId));
    }

    for (const cue of phase2HapticCuesForResolution(result)) {
      this.ports.haptics?.[cue]();
    }
    if (
      result.ok
      && (PHASE2_SCARE_PIN_IDS as readonly number[]).includes(result.pin.id)
    ) {
      this.ports.vhs?.glitch(motion.eventMs.vhsDamageSpike);
    }
  }

  public handleDialAttempt(correct: boolean): void {
    if (!this.ports.audio) return;
    runEffect(() => this.ports.audio!.play(phase2DialAudioCue(correct)));
  }

  public handleSaveWritten(): void {
    if (!this.ports.audio) return;
    runEffect(() => this.ports.audio!.play(SAVE_WRITTEN_AUDIO_CUE));
  }

  public enterFieldDesk(): void {
    if (this.ports.torch) runEffect(() => this.ports.torch!.on());
  }

  public leaveFieldDesk(): void {
    if (this.ports.torch) runEffect(() => this.ports.torch!.off());
  }

  private setHeartbeat(enabled: boolean): void {
    if (this.heartbeatEnabled === enabled) return;
    this.heartbeatEnabled = enabled;
    this.ports.audio?.heartbeat(enabled);
    this.ports.haptics?.heartbeat(enabled);
  }
}

export function isScarePin(pin: Pin): boolean {
  return (PHASE2_SCARE_PIN_IDS as readonly number[]).includes(pin.id);
}
