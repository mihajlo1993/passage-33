import type { ZoneId } from "../types";
import { decodeEmbeddedAudio } from "./assetCodec";
import {
  BED_CROSSFADE_SECONDS,
  createBed,
  type BedHandle,
} from "./beds";
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
  ImpulseManifestEntry,
  OneShotId,
  VoiceId,
} from "./types";

export const AMBIENT_CROSSFADE_SECONDS = BED_CROSSFADE_SECONDS;
export const VISIBILITY_FADE_SECONDS = 1.2;
export const AUDIO_CONTEXT_SAMPLE_RATE = 44_100;
export const VOICE_DUCK_GAIN = 0.3;
export const DEFAULT_ZONE_WET_GAIN = 0.28;

interface AmbientPlayback {
  readonly id: AmbientId;
  readonly bed: BedHandle;
  disposed: boolean;
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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function safeDisconnect(node: { disconnect(): void }): void {
  try {
    node.disconnect();
  } catch {
    // Cancellation and teardown are deliberately idempotent.
  }
}

function safeStop(source: AudioBufferSourceNodeLike): void {
  try {
    source.stop();
  } catch {
    // InvalidStateError means this scheduled source already stopped.
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
  private readonly ambientBeds = new Set<AmbientPlayback>();
  private readonly oneShots = new Set<PromisePlayback>();
  private readonly bedDisposeTimers = new Set<ReturnType<typeof globalThis.setTimeout>>();

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
  private bedTension = 0;
  private heartbeatRequested = false;
  private heartbeatSource: AudioBufferSourceNodeLike | null = null;
  private activeVoice: PromisePlayback | null = null;
  private voiceRequest = 0;

  public constructor(options: AudioEngineOptions = {}) {
    this.contextFactory = options.contextFactory ?? defaultContextFactory;
    this.warn = options.warn ?? ((message) => console.warn(message));
    this.assets = options.audioManifest ?? defaultAudioManifest;
    this.impulses = options.impulseManifest ?? defaultImpulseManifest;

    for (const entry of this.assets) this.entriesById.set(entry.id, entry);
    for (const impulse of this.impulses) this.impulsesByZone.set(impulse.zone, impulse);
  }

  /** Construct and resume only in the first user-gesture call. */
  public unlock(): Promise<void> {
    if (this.disposed) {
      this.report("Cannot unlock a disposed audio engine.");
      return Promise.resolve();
    }
    if (this.context !== null) {
      const resumed = this.resumeContext(this.context);
      if (this.unlockPromise !== null) {
        return Promise.all([this.unlockPromise, resumed]).then(() => undefined);
      }
      return resumed.then(() => this.refreshReadyState());
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

    const pending = this.completeInitialUnlock(this.resumeContext(this.context));
    this.unlockPromise = pending;
    return pending;
  }

  public setZone(zone: ZoneId): void {
    if (this.disposed) return;
    this.requestedZone = zone;
    this.requestedAmbient = `ambient-${zone}`;
    if (this.preloadComplete) {
      // Both switches read the same currentTime and therefore start together.
      this.applyZone(zone);
      this.applyAmbient(this.requestedAmbient);
    }
  }

  public ambient(id: AmbientId | null): void {
    if (this.disposed) return;
    this.requestedAmbient = id;
    if (this.preloadComplete) this.applyAmbient(id);
  }

  public setBedTension(value: number): void {
    this.bedTension = clamp01(value);
    this.activeAmbient?.bed.setTension(this.bedTension);
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
    return this.startPromisePlayback(id, source, false);
  }

  public async say(id: VoiceId): Promise<void> {
    if (this.disposed) {
      this.report(`Audio voice "${id}" was requested after cleanup.`);
      return;
    }
    if (!this.preloadComplete || this.context === null || this.graph === null) {
      this.report(`Audio voice "${id}" was requested before audio was ready.`);
      return;
    }
    const entry = this.entriesById.get(id);
    if (entry === undefined || entry.category !== "voice") {
      this.report(`Audio voice "${id}" is missing.`);
      return;
    }
    if (entry.hex === null) {
      this.report(`Audio voice "${id}" has no compiled bytes.`);
      return;
    }
    if (entry.placeholder) {
      this.report(`Voice "${id}" is a silent placeholder; replace its public MP3 and regenerate.`);
    }

    const context = this.context;
    const request = ++this.voiceRequest;
    this.cancelActiveVoice();
    let ready: AudioBufferLike;
    try {
      ready = await decodeEmbeddedAudio(context, entry.hex);
    } catch (error) {
      this.failedAssets.add(id);
      this.reportError(`Could not decode audio asset "${id}"`, error);
      return;
    }
    if (this.disposed || request !== this.voiceRequest || this.graph === null) return;

    let source: AudioBufferSourceNodeLike;
    try {
      source = context.createBufferSource();
      source.buffer = ready;
      source.loop = false;
      source.connect(this.graph.voiceBus);
    } catch (error) {
      this.reportError(`Could not prepare voice "${id}"`, error);
      return;
    }
    await this.startPromisePlayback(id, source, true);
  }

  public heartbeat(enabled: boolean): void {
    if (this.disposed) return;
    this.heartbeatRequested = enabled;
    if (!this.preloadComplete) return;
    if (enabled) this.startHeartbeat();
    else this.stopHeartbeat();
  }

  public setMaster(level: number): void {
    this.masterLevel = clamp01(level);
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
    ) return;

    if (this.context.state !== "running" && this.context.state !== "closed") {
      void this.resumeContext(this.context).then(() => this.refreshReadyState());
    }
    if (this.activeAmbient !== null) {
      rampAudioParam(
        this.activeAmbient.bed.output.gain,
        1,
        this.context.currentTime,
        VISIBILITY_FADE_SECONDS,
        0,
      );
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.phase = "error";
    this.voiceRequest += 1;
    this.cancelActiveVoice();
    for (const playback of [...this.oneShots]) this.finishOneShot(playback, true);
    for (const playback of [...this.ambientBeds]) this.finishAmbient(playback);
    for (const timer of this.bedDisposeTimers) globalThis.clearTimeout(timer);
    this.bedDisposeTimers.clear();
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
    const audioJobs = this.assets
      .filter((entry) => entry.category === "oneshot")
      .map(async (entry) => {
        if (entry.hex === null) return;
        try {
          const context = this.context;
          if (context === null) return;
          const decoded = await decodeEmbeddedAudio(context, entry.hex);
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
        const decoded = await decodeEmbeddedAudio(context, entry.hex);
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
    try {
      return context.resume().catch((error: unknown) => {
        this.reportError("Could not resume the Web Audio context", error);
      });
    } catch (error) {
      this.reportError("Could not resume the Web Audio context", error);
      return Promise.resolve();
    }
  }

  private refreshReadyState(): void {
    if (this.disposed || !this.preloadComplete || this.context === null) return;
    this.phase = this.context.state === "running" ? "ready" : "suspended";
  }

  private applyZone(zone: ZoneId): void {
    if (this.context === null || this.graph === null || this.appliedZone === zone) return;
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
      clamp01(entry.wet ?? DEFAULT_ZONE_WET_GAIN),
      this.context.currentTime,
    );
    this.appliedZone = zone;
  }

  private applyAmbient(id: AmbientId | null): void {
    if (this.context === null || this.graph === null || id === this.activeAmbient?.id) return;
    const previous = this.activeAmbient;
    this.activeAmbient = null;
    if (id === null) {
      if (previous !== null) this.fadeOutAmbient(previous);
      return;
    }

    let bed: BedHandle;
    try {
      bed = createBed(this.context, id, this.graph.ambientBus);
      bed.output.gain.value = 0;
      bed.setTension(this.bedTension);
    } catch (error) {
      this.reportError(`Could not construct ambient bed "${id}"`, error);
      return;
    }
    const playback: AmbientPlayback = { id, bed, disposed: false };
    this.ambientBeds.add(playback);
    this.activeAmbient = playback;
    rampAudioParam(
      bed.output.gain,
      1,
      this.context.currentTime,
      AMBIENT_CROSSFADE_SECONDS,
      0,
    );
    if (previous !== null) this.fadeOutAmbient(previous);
  }

  private fadeOutAmbient(playback: AmbientPlayback): void {
    if (this.context === null || playback.disposed) return;
    rampAudioParam(
      playback.bed.output.gain,
      0,
      this.context.currentTime,
      AMBIENT_CROSSFADE_SECONDS,
    );
    const timer = globalThis.setTimeout(() => {
      this.bedDisposeTimers.delete(timer);
      this.finishAmbient(playback);
    }, AMBIENT_CROSSFADE_SECONDS * 1_000 + 20);
    this.bedDisposeTimers.add(timer);
  }

  private finishAmbient(playback: AmbientPlayback): void {
    if (playback.disposed) return;
    playback.disposed = true;
    playback.bed.dispose();
    this.ambientBeds.delete(playback);
    if (this.activeAmbient === playback) this.activeAmbient = null;
  }

  private startPromisePlayback(
    id: string,
    source: AudioBufferSourceNodeLike,
    voice: boolean,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const playback: PromisePlayback = {
        id,
        source,
        resolve,
        onError: () => {
          this.report(`${voice ? "Voice" : "One-shot"} "${id}" failed during playback.`);
          if (voice) this.finishVoice(playback);
          else this.finishOneShot(playback);
        },
        finished: false,
      };
      source.onended = () => {
        if (voice) this.finishVoice(playback);
        else this.finishOneShot(playback);
      };
      source.addEventListener?.("error", playback.onError, { once: true });
      if (voice) {
        this.activeVoice = playback;
        this.setAmbientDuck(true);
      } else {
        this.oneShots.add(playback);
      }
      try {
        source.start(this.context!.currentTime);
      } catch (error) {
        this.reportError(`Could not start ${voice ? "voice" : "one-shot"} "${id}"`, error);
        if (voice) this.finishVoice(playback);
        else this.finishOneShot(playback);
      }
    });
  }

  private startHeartbeat(): void {
    if (this.heartbeatSource !== null || this.context === null || this.graph === null) return;
    const buffer = this.resolveBuffer("heartbeat", "oneshot");
    if (buffer === null) return;
    try {
      const source = this.context.createBufferSource();
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
      if (this.heartbeatSource !== null) safeDisconnect(this.heartbeatSource);
      this.heartbeatSource = null;
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
      const reason = entry.hex === null
        ? "has no compiled bytes"
        : this.failedAssets.has(id)
          ? "could not be decoded"
          : "is unavailable";
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
