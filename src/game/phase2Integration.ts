import type { VoicePlaybackHandle } from "../audio/types";
import { getVHSHealthProfile, type VHSHealthProfile } from "../fx";
import { getPinById, pins } from "../pins";
import { motion } from "../tokens";
import type { GameState, HostVoiceId, Pin, ZoneId } from "../types";
import type { PinResolutionResult } from "./engine";

// Derived from the pin data so an edited chapter graph can never drift from
// the effect wiring.
export const PHASE2_SCARE_PIN_IDS: readonly number[] = pins
  .filter((pin) => pin.kind === "scare")
  .map((pin) => pin.id);
export const IMAGE_AR_PIN_IDS: readonly number[] = pins
  .filter((pin) => pin.resolution === "ar" && pin.scare !== "roomMonster")
  .map((pin) => pin.id);
export const ROOM_AR_PIN_ID = pins
  .find((pin) => pin.scare === "roomMonster")?.id ?? -1;
export const FIELD_DESK_PIN_ID = 15;

export type Phase2ArRoute = "image" | "room" | null;
export type Phase2HapticCue = "contact" | "found" | "stutter";

const SCARE_AUDIO_CUES = {
  torchKill: "stinger-a",
  roomMonster: "stinger-b",
  closeQuarters: "stinger-c",
} as const;

export const PHASE2_VOICE_CUES_BY_PIN: Readonly<Partial<Record<number, HostVoiceId>>> = {};

export const SAVE_WRITTEN_AUDIO_CUE = "write";
export const DIAL_WRONG_AUDIO_CUE = "refused";
export const DIAL_CORRECT_AUDIO_CUE = "released";
export const DELAYED_STINGER_MS = 800;

export interface Phase2AudioPort {
  setZone(zone: ZoneId): void;
  setBedTension?(value: number): void;
  play(id: string): void | Promise<void>;
  startVoice?(id: HostVoiceId): Promise<VoicePlaybackHandle | null>;
  heartbeat(enabled: boolean): void;
}

export interface Phase2VoicePort {
  claim(id: HostVoiceId): boolean;
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
  readonly voices?: Phase2VoicePort;
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
  _state: Pick<GameState, "inventory">,
  shotFired: boolean,
): boolean {
  return shotFired;
}

export function phase2AudioCuesForResolution(
  result: PinResolutionResult,
): readonly string[] {
  if (!result.ok) return ["refused"];

  const cues: string[] = [];
  if (result.grantedItems.length > 0) cues.push("found");
  if (result.pin.resolution === "dial") cues.push("released");

  if (result.pin.scare) {
    cues.push(
      result.pin.scare === "torchKill"
        ? SCARE_AUDIO_CUES.torchKill
        : "drag",
    );
  }
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

export function healthToBedTension(health: number): number {
  if (!Number.isFinite(health)) return 0;
  return Math.min(1, Math.max(0, (100 - health) / 80));
}

function latestResolvedZone(resolvedPins: readonly number[]): ZoneId {
  const pinId = resolvedPins.at(-1);
  return pinId === undefined ? "corridor" : (getPinById(pinId)?.zone ?? "corridor");
}

export class Phase2IntegrationCoordinator {
  private currentZone: ZoneId | null = null;
  private heartbeatEnabled: boolean | null = null;
  private readonly delayedStingerTimers = new Set<ReturnType<typeof setTimeout>>();

  public constructor(private readonly ports: Phase2IntegrationPorts) {}

  public startSession(): void {
    if (this.ports.wakeLock) {
      runEffect(() => this.ports.wakeLock!.acquire());
    }
  }

  public stopSession(): void {
    this.setHeartbeat(false);
    for (const timer of this.delayedStingerTimers) {
      clearTimeout(timer);
    }
    this.delayedStingerTimers.clear();
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
    return zone;
  }

  public syncHealth(health: number): VHSHealthProfile {
    const profile = phase2HealthProfile(health);
    this.ports.vhs?.setIntensity(profile.intensity);
    this.ports.vhs?.setTimecode(
      profile.unstableTimecode ? "REC --:--:--" : null,
    );
    this.ports.audio?.setBedTension?.(healthToBedTension(health));
    if (profile.periodicDropFrames) {
      this.ports.vhs?.dropFrames(motion.eventMs.vhsCriticalDrop);
    }
    this.setHeartbeat(health < 40);
    return profile;
  }

  public async startVoiceForPin(pinId: number): Promise<VoicePlaybackHandle | null> {
    const voiceId = PHASE2_VOICE_CUES_BY_PIN[pinId];
    const startVoice = this.ports.audio?.startVoice;
    if (
      voiceId === undefined
      || startVoice === undefined
      || this.ports.voices?.claim(voiceId) !== true
    ) {
      return null;
    }

    try {
      return await startVoice(voiceId);
    } catch {
      return null;
    }
  }

  public handleResolution(result: PinResolutionResult): void {
    if (result.ok) this.syncZone(result.pin.zone);

    for (const cue of phase2AudioCuesForResolution(result)) {
      if (this.ports.audio) {
        runEffect(() => this.ports.audio!.play(cue));
      }
    }
    if (result.ok) {
      void this.startVoiceForPin(result.pin.id);
      if (result.pin.scare && result.pin.scare !== "torchKill") {
        this.scheduleDelayedStinger(SCARE_AUDIO_CUES[result.pin.scare]);
      }
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

  private scheduleDelayedStinger(id: string): void {
    if (!this.ports.audio) return;
    const timer = setTimeout(() => {
      this.delayedStingerTimers.delete(timer);
      if (this.ports.audio) {
        runEffect(() => this.ports.audio!.play(id));
      }
    }, DELAYED_STINGER_MS);
    this.delayedStingerTimers.add(timer);
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
