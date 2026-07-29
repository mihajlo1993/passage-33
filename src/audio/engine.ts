import type { ZoneId } from "../types";
import { decodeEmbeddedAudio } from "./assetCodec";
import {
  createAudioGraph,
  crossfadeImpulse,
  disconnectAudioGraph,
  rampAudioParam,
} from "./graph";
import {
  audioManifest as defaultAudioManifest,
  impulseManifest as defaultImpulseManifest,
} from "./manifest";
import type {
  AmbientId,
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  AudioEngineOptions,
  AudioGraph,
  AudioManifestEntry,
  AudioMasterState,
  GainNodeLike,
  ImpulseManifestEntry,
  OneShotId,
  VoiceId,
} from "./types";

export const AMBIENT_CROSSFADE_SECONDS = 1.2;
export const AUDIO_CONTEXT_SAMPLE_RATE = 24_000;
export const VOICE_DUCK_GAIN = 0.3;
export const DEFAULT_ZONE_WET_GAIN = 0.28;

interface AmbientPlayback {
  readonly id: AmbientId;
  readonly source: AudioBufferSourceNodeLike;
  readonly gain: GainNodeLike;
  finished: boolean;
}

interface PromisePlayback {
  readonly id: string;
  readonly source: AudioBufferSourceNodeLike;
  readonly resolve: () => void;
  readonly onError: () => void;
  finished: boolean;
}

function defaultContextFactory(): AudioContextLike {
  const ContextConstructor = globalThis.AudioContext;
  if (typeof ContextConstructor !== "function") {
    throw new Error("Web Audio is unavailable");
  }
  return new ContextConstructor({
    sampleRate: AUDIO_CONTEXT_SAMPLE_RATE,
  }) as unknown as AudioContextLike;
}

function clampGain(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function safeDisconnect(node: { disconnect(): void }): void {
  try {
    node.disconnect();
  } catch {
    // Disconnect is intentionally idempotent during cancellation and teardown.
  }
}

function safeStop(source: AudioBufferSourceNodeLike, when?: number): void {
  try {
    source.stop(when);
  } catch {
    // InvalidStateError means this one-shot source was already stopped.
  }
}

export class AudioEngine {
  private readonly contextFactory: () => AudioContextLike;
  private readonly warn: (message: string) => void;
  private readonly assets: readonly AudioManifestEntry[];
  private readonly impulses: readonly ImpulseManifestEntry[];
  private readonly entriesById = new Map<string, AudioManifestEntry>();
  private readonly impulsesByZone = new Map<ZoneId, ImpulseManifestEntry>();
  private readonly buffers = new Map<string, AudioBufferLike>();
  private readonly impulseBuffers = new Map<ZoneId, AudioBufferLike>();
  private readonly failedAssets = new Set<string>();
  private readonly failedImpulses = new Set<ZoneId>();
  private readonly ambientSources = new Set<AmbientPlayback>();
  private readonly oneShots = new Set<PromisePlayback>();

  private context: AudioContextLike | null = null;
  private graph: AudioGraph | null = null;
  private phase: AudioMasterState = "locked";
  private unlockPromise: Promise<void> | null = null;
  private preloadComplete = false;
  private disposed = false;
  private masterLevel = 1;
  private muted = false;
  private requestedZone: ZoneId | null = null;
  private appliedZone: ZoneId | null = null;
  private requestedAmbient: AmbientId | null = null;
  private activeAmbient: AmbientPlayback | null = null;
  private heartbeatRequested = false;
  private heartbeatSource: AudioBufferSourceNodeLike | null = null;
  private activeVoice: PromisePlayback | null = null;

  public constructor(options: AudioEngineOptions = {}) {
    this.contextFactory = options.contextFactory ?? defaultContextFactory;
    this.warn = options.warn ?? ((message) => console.warn(message));
    this.assets = options.audioManifest ?? defaultAudioManifest;
    this.impulses = options.impulseManifest ?? defaultImpulseManifest;

    for (const entry of this.assets) this.entriesById.set(entry.id, entry);
    for (const impulse of this.impulses) {
      this.impulsesByZone.set(impulse.zone, impulse);
    }
  }

  /**
   * Must be called from a user gesture. Construction and resume() both happen
   * before this method returns its first Promise to the caller.
   */
  public unlock(): Promise<void> {
    if (this.disposed) {
      this.report("Cannot unlock a disposed audio engine.");
      return Promise.resolve();
    }

    if (this.context !== null) {
      const resumePromise = this.resumeContext(this.context);
      if (this.unlockPromise !== null) {
        return Promise.all([this.unlockPromise, resumePromise]).then(() => undefined);
      }
      return resumePromise.then(() => {
        this.refreshReadyState();
      });
    }

    this.phase = "loading";
    try {
      this.context = this.contextFactory();
      this.graph = createAudioGraph(this.context);
      this.applyMasterGain();
    } catch (error) {
      this.phase = "error";
      this.reportError("Could not create the Web Audio context", error);
      return Promise.resolve();
    }

    const resumePromise = this.resumeContext(this.context);
    const pending = this.completeInitialUnlock(resumePromise);
    this.unlockPromise = pending;
    return pending;
  }

  public setZone(zone: ZoneId): void {
    if (this.disposed) return;
    this.requestedZone = zone;
    const zoneBed = `ambient-${zone}`;
    this.requestedAmbient = zoneBed;
    if (this.preloadComplete) {
      this.applyZone(zone);
      this.applyAmbient(zoneBed);
    }
  }

  public ambient(id: AmbientId | null): void {
    if (this.disposed) return;
    this.requestedAmbient = id;
    if (this.preloadComplete) this.applyAmbient(id);
  }

  public play(id: OneShotId): Promise<void> {
    const ready = this.resolveBuffer(id, "oneshot");
    if (ready === null || this.context === null || this.graph === null) {
      return Promise.resolve();
    }

    let source: AudioBufferSourceNodeLike;
    try {
      source = this.context.createBufferSource();
      source.buffer = ready;
      source.loop = false;
      source.connect(this.graph.oneshotBus);
    } catch (error) {
      this.reportError(`Could not prepare one-shot "${id}"`, error);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const playback: PromisePlayback = {
        id,
        source,
        resolve,
        onError: () => {
          this.report(`One-shot "${id}" failed during playback.`);
          this.finishOneShot(playback);
        },
        finished: false,
      };
      source.onended = () => this.finishOneShot(playback);
      source.addEventListener?.("error", playback.onError, { once: true });
      this.oneShots.add(playback);
      try {
        source.start(this.context!.currentTime);
      } catch (error) {
        this.reportError(`Could not start one-shot "${id}"`, error);
        this.finishOneShot(playback);
      }
    });
  }

  public say(id: VoiceId): Promise<void> {
    const ready = this.resolveBuffer(id, "voice");
    if (ready === null || this.context === null || this.graph === null) {
      return Promise.resolve();
    }

    this.cancelActiveVoice();
    let source: AudioBufferSourceNodeLike;
    try {
      source = this.context.createBufferSource();
      source.buffer = ready;
      source.loop = false;
      source.connect(this.graph.voiceBus);
    } catch (error) {
      this.reportError(`Could not prepare voice "${id}"`, error);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const playback: PromisePlayback = {
        id,
        source,
        resolve,
        onError: () => {
          this.report(`Voice "${id}" failed during playback.`);
          this.finishVoice(playback);
        },
        finished: false,
      };
      source.onended = () => this.finishVoice(playback);
      source.addEventListener?.("error", playback.onError, { once: true });
      this.activeVoice = playback;
      this.setAmbientDuck(true);
      try {
        source.start(this.context!.currentTime);
      } catch (error) {
        this.reportError(`Could not start voice "${id}"`, error);
        this.finishVoice(playback);
      }
    });
  }

  public heartbeat(enabled: boolean): void {
    if (this.disposed) return;
    this.heartbeatRequested = enabled;
    if (!this.preloadComplete) return;
    if (enabled) this.startHeartbeat();
    else this.stopHeartbeat();
  }
  public silence(): void {
    if (this.disposed) return;
    this.requestedAmbient = null;
    this.heartbeatRequested = false;
    this.cancelActiveVoice();
    for (const playback of [...this.oneShots]) this.finishOneShot(playback, true);
    for (const playback of [...this.ambientSources]) {
      this.finishAmbient(playback, true);
    }
    this.stopHeartbeat();
  }

  public setMaster(level: number): void {
    this.masterLevel = clampGain(level);
    this.applyMasterGain();
  }

  public mute(muted: boolean): void {
    this.muted = muted;
    this.applyMasterGain();
  }

  public getState(): AudioMasterState {
    if (this.disposed || this.phase === "error") return "error";
    if (this.context === null) return "locked";
    if (this.phase === "loading") return "loading";
    if (this.context.state === "closed") return "error";
    if (this.context.state !== "running") return "suspended";
    return "ready";
  }

  public handleVisibility(visibilityState: DocumentVisibilityState): void {
    if (
      visibilityState !== "visible" ||
      this.disposed ||
      this.context === null ||
      this.graph === null
    ) {
      return;
    }

    if (this.context.state !== "running" && this.context.state !== "closed") {
      void this.resumeContext(this.context).then(() => this.refreshReadyState());
    }

    if (this.activeAmbient !== null) {
      rampAudioParam(
        this.activeAmbient.gain.gain,
        1,
        this.context.currentTime,
        AMBIENT_CROSSFADE_SECONDS,
        0,
      );
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.phase = "error";

    this.cancelActiveVoice();
    for (const playback of [...this.oneShots]) this.finishOneShot(playback, true);
    for (const playback of [...this.ambientSources]) {
      this.finishAmbient(playback, true);
    }
    this.stopHeartbeat();

    if (this.graph !== null) disconnectAudioGraph(this.graph);
    const context = this.context;
    if (context !== null && context.state !== "closed" && context.close) {
      try {
        void context.close().catch((error: unknown) => {
          this.reportError("Could not close the Web Audio context", error);
        });
      } catch (error) {
        this.reportError("Could not close the Web Audio context", error);
      }
    }

    this.graph = null;
    this.activeAmbient = null;
    this.heartbeatSource = null;
    this.buffers.clear();
    this.impulseBuffers.clear();
  }

  private async completeInitialUnlock(resumePromise: Promise<void>): Promise<void> {
    await resumePromise;
    await this.preloadAll();
    this.preloadComplete = true;
    this.unlockPromise = null;
    if (this.disposed) return;

    this.refreshReadyState();
    if (this.requestedZone !== null) this.applyZone(this.requestedZone);
    this.applyAmbient(this.requestedAmbient);
    if (this.heartbeatRequested) this.startHeartbeat();
  }

  private async preloadAll(): Promise<void> {
    const audioJobs = this.assets.map(async (entry) => {
      try {
        const context = this.context;
        if (context === null) return;
        const decoded = await decodeEmbeddedAudio(context, entry.base64);
        if (!this.disposed) this.buffers.set(entry.id, decoded);
      } catch (error) {
        this.failedAssets.add(entry.id);
        this.reportError(`Could not decode audio asset "${entry.id}"`, error);
      }
    });
    const impulseJobs = this.impulses.map(async (entry) => {
      try {
        const context = this.context;
        if (context === null) return;
        const decoded = await decodeEmbeddedAudio(context, entry.base64);
        if (!this.disposed) this.impulseBuffers.set(entry.zone, decoded);
      } catch (error) {
        this.failedImpulses.add(entry.zone);
        this.reportError(`Could not decode impulse "${entry.id}"`, error);
      }
    });
    await Promise.all([...audioJobs, ...impulseJobs]);
  }

  private resumeContext(context: AudioContextLike): Promise<void> {
    if (context.state === "running") return Promise.resolve();
    if (context.state === "closed") {
      this.phase = "error";
      this.report("Cannot resume a closed Web Audio context.");
      return Promise.resolve();
    }

    let resumeResult: Promise<void>;
    try {
      resumeResult = context.resume();
    } catch (error) {
      this.reportError("Could not resume the Web Audio context", error);
      return Promise.resolve();
    }
    return resumeResult.catch((error: unknown) => {
      this.reportError("Could not resume the Web Audio context", error);
    });
  }

  private refreshReadyState(): void {
    if (this.disposed || !this.preloadComplete || this.context === null) return;
    this.phase = this.context.state === "running" ? "ready" : "suspended";
  }

  private applyZone(zone: ZoneId): void {
    if (this.context === null || this.graph === null || this.appliedZone === zone) {
      return;
    }
    const entry = this.impulsesByZone.get(zone);
    const buffer = this.impulseBuffers.get(zone);
    if (entry === undefined) {
      this.report(`Impulse for zone "${zone}" is missing.`);
      return;
    }
    if (buffer === undefined) {
      const reason = this.failedImpulses.has(zone) ? "could not be decoded" : "is unavailable";
      this.report(`Impulse "${entry.id}" ${reason}.`);
      return;
    }

    crossfadeImpulse(
      this.graph,
      buffer,
      clampGain(entry.wet ?? DEFAULT_ZONE_WET_GAIN),
      this.context.currentTime,
    );
    this.appliedZone = zone;
  }

  private applyAmbient(id: AmbientId | null): void {
    if (this.context === null || this.graph === null) return;
    if (id === this.activeAmbient?.id) return;

    if (id === null) {
      const previous = this.activeAmbient;
      this.activeAmbient = null;
      if (previous !== null) this.fadeOutAmbient(previous);
      return;
    }

    const buffer = this.resolveBuffer(id, "ambient");
    if (buffer === null) return;

    let source: AudioBufferSourceNodeLike;
    let gain: GainNodeLike;
    try {
      source = this.context.createBufferSource();
      gain = this.context.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      gain.connect(this.graph.ambientBus);
    } catch (error) {
      this.reportError(`Could not prepare ambient bed "${id}"`, error);
      return;
    }

    const playback: AmbientPlayback = { id, source, gain, finished: false };
    source.onended = () => this.finishAmbient(playback);
    try {
      source.start(this.context.currentTime);
    } catch (error) {
      this.reportError(`Could not start ambient bed "${id}"`, error);
      this.finishAmbient(playback);
      return;
    }

    this.ambientSources.add(playback);
    rampAudioParam(
      gain.gain,
      1,
      this.context.currentTime,
      AMBIENT_CROSSFADE_SECONDS,
      0,
    );
    const previous = this.activeAmbient;
    this.activeAmbient = playback;
    if (previous !== null) this.fadeOutAmbient(previous);
  }

  private fadeOutAmbient(playback: AmbientPlayback): void {
    if (this.context === null || playback.finished) return;
    rampAudioParam(
      playback.gain.gain,
      0,
      this.context.currentTime,
      AMBIENT_CROSSFADE_SECONDS,
    );
    safeStop(playback.source, this.context.currentTime + AMBIENT_CROSSFADE_SECONDS);
  }

  private finishAmbient(playback: AmbientPlayback, stopNow = false): void {
    if (playback.finished) return;
    playback.finished = true;
    playback.source.onended = null;
    if (stopNow) safeStop(playback.source);
    safeDisconnect(playback.source);
    safeDisconnect(playback.gain);
    this.ambientSources.delete(playback);
    if (this.activeAmbient === playback) this.activeAmbient = null;
  }

  private startHeartbeat(): void {
    if (this.heartbeatSource !== null || this.context === null || this.graph === null) {
      return;
    }
    const buffer = this.resolveBuffer("heartbeat", "oneshot");
    if (buffer === null) return;

    let source: AudioBufferSourceNodeLike;
    try {
      source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.graph.oneshotBus);
      source.onended = () => {
        if (this.heartbeatSource === source) this.heartbeatSource = null;
        safeDisconnect(source);
      };
      this.heartbeatSource = source;
      source.start(this.context.currentTime);
    } catch (error) {
      if (this.heartbeatSource !== null) {
        const failedSource = this.heartbeatSource;
        this.heartbeatSource = null;
        safeDisconnect(failedSource);
      }
      this.reportError("Could not start heartbeat", error);
    }
  }

  private stopHeartbeat(): void {
    const source = this.heartbeatSource;
    this.heartbeatSource = null;
    if (source === null) return;
    source.onended = null;
    safeStop(source);
    safeDisconnect(source);
  }

  private resolveBuffer(
    id: string,
    category: AudioManifestEntry["category"],
  ): AudioBufferLike | null {
    if (this.disposed) {
      this.report(`Audio ${category} "${id}" was requested after cleanup.`);
      return null;
    }
    if (!this.preloadComplete || this.context === null || this.graph === null) {
      this.report(`Audio ${category} "${id}" was requested before audio was ready.`);
      return null;
    }
    const entry = this.entriesById.get(id);
    if (entry === undefined || entry.category !== category) {
      this.report(`Audio ${category} "${id}" is missing.`);
      return null;
    }
    const buffer = this.buffers.get(id);
    if (buffer === undefined) {
      const reason = this.failedAssets.has(id) ? "could not be decoded" : "is unavailable";
      this.report(`Audio ${category} "${id}" ${reason}.`);
      return null;
    }
    return buffer;
  }

  private finishOneShot(playback: PromisePlayback, stopNow = false): void {
    if (playback.finished) return;
    playback.finished = true;
    playback.source.onended = null;
    playback.source.removeEventListener?.("error", playback.onError);
    if (stopNow) safeStop(playback.source);
    safeDisconnect(playback.source);
    this.oneShots.delete(playback);
    playback.resolve();
  }

  private cancelActiveVoice(): void {
    const playback = this.activeVoice;
    if (playback === null) return;
    safeStop(playback.source);
    this.finishVoice(playback);
  }

  private finishVoice(playback: PromisePlayback): void {
    if (playback.finished) return;
    playback.finished = true;
    playback.source.onended = null;
    playback.source.removeEventListener?.("error", playback.onError);
    safeDisconnect(playback.source);
    if (this.activeVoice === playback) {
      this.activeVoice = null;
      this.setAmbientDuck(false);
    }
    playback.resolve();
  }

  private setAmbientDuck(ducked: boolean): void {
    if (this.context === null || this.graph === null) return;
    const parameter = this.graph.ambientBus.gain;
    parameter.cancelScheduledValues(this.context.currentTime);
    parameter.setValueAtTime(ducked ? VOICE_DUCK_GAIN : 1, this.context.currentTime);
  }

  private applyMasterGain(): void {
    if (this.context === null || this.graph === null) return;
    const parameter = this.graph.master.gain;
    parameter.cancelScheduledValues(this.context.currentTime);
    parameter.setValueAtTime(this.muted ? 0 : this.masterLevel, this.context.currentTime);
  }

  private report(message: string): void {
    try {
      this.warn(`[audio] ${message}`);
    } catch {
      // Diagnostics must never make playback control throw.
    }
  }

  private reportError(message: string, error: unknown): void {
    const detail = error instanceof Error && error.message ? `: ${error.message}` : "";
    this.report(message + detail);
  }
}
