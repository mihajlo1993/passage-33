import type { ZoneId } from "../types";
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
  AudioFetcher,
  AudioGraph,
  AudioManifestEntry,
  AudioMasterState,
  ImpulseManifestEntry,
  OneShotId,
  VoiceId,
  VoicePlaybackHandle,
} from "./types";

export const AMBIENT_CROSSFADE_SECONDS = BED_CROSSFADE_SECONDS;
export const VISIBILITY_FADE_SECONDS = 1.2;
export const AUDIO_CONTEXT_SAMPLE_RATE = 44_100;
export const VOICE_DUCK_GAIN = 0.3;
export const DEFAULT_ZONE_WET_GAIN = 0.28;
export const INITIAL_ONE_SHOT_IDS = [
  "found",
  "refused",
  "released",
  "dial-tick",
  "write",
  "stinger-a",
  "heartbeat",
] as const;

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

interface VoicePlayback {
  readonly id: VoiceId;
  readonly source: AudioBufferSourceNodeLike;
  readonly durationSeconds: number;
  readonly startedAt: number;
  readonly finishedPromise: Promise<void>;
  readonly resolveFinished: () => void;
  readonly onError: () => void;
  finished: boolean;
  finalPositionSeconds: number;
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

const defaultFetcher: AudioFetcher = async (publicPath) => globalThis.fetch(publicPath);

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

function assertLocalAudioPath(publicPath: string): void {
  const segments = publicPath.split("/");
  if (
    !publicPath.startsWith("/audio/")
    || publicPath.includes("\\")
    || publicPath.includes("?")
    || publicPath.includes("#")
    || segments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error(`Audio path must stay under /audio/: ${publicPath}`);
  }
}

function isSilentBuffer(buffer: AudioBufferLike): boolean {
  if (typeof buffer.getChannelData !== "function") return false;
  const channelCount = Math.max(1, buffer.numberOfChannels ?? 1);
  try {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const samples = buffer.getChannelData(channel);
      const stride = Math.max(1, Math.floor(samples.length / 32_768));
      for (let index = 0; index < samples.length; index += stride) {
        if (Math.abs(samples[index]) > 0.00001) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export class AudioEngine {
  private readonly contextFactory: () => AudioContextLike;
  private readonly fetcher: AudioFetcher;
  private readonly warn: (message: string) => void;
  private readonly assets: readonly AudioManifestEntry[];
  private readonly impulses: readonly ImpulseManifestEntry[];
  private readonly entriesById = new Map<string, AudioManifestEntry>();
  private readonly impulsesByZone = new Map<ZoneId, ImpulseManifestEntry>();
  private readonly buffers = new Map<string, AudioBufferLike>();
  private readonly impulseBuffers = new Map<ZoneId, AudioBufferLike>();
  private readonly assetLoads = new Map<string, Promise<AudioBufferLike | null>>();
  private readonly impulseLoads = new Map<ZoneId, Promise<AudioBufferLike | null>>();
  private readonly failedAssets = new Set<string>();
  private readonly failedImpulses = new Set<ZoneId>();
  private readonly placeholderVoices = new Set<VoiceId>();
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
  private activeVoice: VoicePlayback | null = null;
  private voiceRequest = 0;
  private playbackEpoch = 0;
  private loadGeneration = 0;

  public constructor(options: AudioEngineOptions = {}) {
    this.contextFactory = options.contextFactory ?? defaultContextFactory;
    this.fetcher = options.fetcher ?? defaultFetcher;
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
      void this.applyZone(zone, this.playbackEpoch);
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

  public async play(id: OneShotId): Promise<void> {
    const environment = this.readyEnvironment("oneshot", id);
    if (environment === null) return;
    const entry = this.entriesById.get(id);
    if (entry === undefined || entry.category !== "oneshot") {
      this.report(`Audio oneshot "${id}" is missing.`);
      return;
    }

    const epoch = this.playbackEpoch;
    const cachedBuffer = this.buffers.get(entry.id);
    const buffer = cachedBuffer ?? await this.loadAsset(entry);
    if (
      buffer === null
      || this.disposed
      || epoch !== this.playbackEpoch
      || this.context !== environment.context
      || this.graph !== environment.graph
    ) return;

    let source: AudioBufferSourceNodeLike;
    try {
      source = environment.context.createBufferSource();
      source.buffer = buffer;
      source.loop = false;
      source.connect(environment.graph.oneshotBus);
    } catch (error) {
      this.reportError(`Could not prepare one-shot "${id}"`, error);
      return;
    }
    await this.startOneShot(id, source, environment.context);
  }

  public async startVoice(id: VoiceId): Promise<VoicePlaybackHandle | null> {
    const environment = this.readyEnvironment("voice", id);
    if (environment === null) return null;
    const entry = this.entriesById.get(id);
    if (entry === undefined || entry.category !== "voice") {
      this.report(`Audio voice "${id}" is missing.`);
      return null;
    }
    if (this.placeholderVoices.has(id)) {
      this.report(`Voice "${id}" is a silent placeholder.`);
      return null;
    }

    const epoch = this.playbackEpoch;
    const request = ++this.voiceRequest;
    const cachedBuffer = this.buffers.get(entry.id);
    const buffer = cachedBuffer ?? await this.loadAsset(entry);
    if (
      buffer === null
      || this.disposed
      || epoch !== this.playbackEpoch
      || request !== this.voiceRequest
      || this.context !== environment.context
      || this.graph !== environment.graph
    ) return null;

    if (isSilentBuffer(buffer)) {
      this.placeholderVoices.add(id);
      this.report(`Voice "${id}" is a silent placeholder.`);
      return null;
    }

    let source: AudioBufferSourceNodeLike;
    try {
      source = environment.context.createBufferSource();
      source.buffer = buffer;
      source.loop = false;
      source.connect(environment.graph.voiceBus);
    } catch (error) {
      this.reportError(`Could not prepare voice "${id}"`, error);
      return null;
    }

    this.cancelActiveVoice(true);
    return this.startVoiceSource(entry, buffer, source, environment.context);
  }

  public async say(id: VoiceId): Promise<void> {
    const playback = await this.startVoice(id);
    if (playback !== null) await playback.finished;
  }

  public heartbeat(enabled: boolean): void {
    if (this.disposed) return;
    this.heartbeatRequested = enabled;
    if (!this.preloadComplete) return;
    if (enabled) void this.startHeartbeat(this.playbackEpoch);
    else this.stopHeartbeat();
  }

  public silence(): void {
    if (this.disposed) return;
    this.invalidatePendingWork();
    this.requestedAmbient = null;
    this.heartbeatRequested = false;
    this.cancelActiveVoice();
    for (const playback of [...this.oneShots]) this.finishOneShot(playback, true);
    for (const timer of this.bedDisposeTimers) globalThis.clearTimeout(timer);
    this.bedDisposeTimers.clear();
    for (const playback of [...this.ambientBeds]) this.finishAmbient(playback);
    this.stopHeartbeat();
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
      visibilityState !== "visible"
      || this.disposed
      || this.context === null
      || this.graph === null
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
    this.invalidatePendingWork();
    this.cancelActiveVoice();
    for (const playback of [...this.oneShots]) this.finishOneShot(playback, true);
    for (const timer of this.bedDisposeTimers) globalThis.clearTimeout(timer);
    this.bedDisposeTimers.clear();
    for (const playback of [...this.ambientBeds]) this.finishAmbient(playback);
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
    this.assetLoads.clear();
    this.impulseLoads.clear();
  }

  private async completeInitialUnlock(resumePromise: Promise<void>): Promise<void> {
    await resumePromise;
    await this.preloadInitialAssets();
    this.preloadComplete = true;
    this.unlockPromise = null;
    if (this.disposed) return;
    this.refreshReadyState();
    const epoch = this.playbackEpoch;
    if (this.requestedZone !== null) void this.applyZone(this.requestedZone, epoch);
    this.applyAmbient(this.requestedAmbient);
    if (this.heartbeatRequested) void this.startHeartbeat(epoch);
  }

  private async preloadInitialAssets(): Promise<void> {
    const jobs: Array<Promise<AudioBufferLike | null>> = [];
    for (const id of INITIAL_ONE_SHOT_IDS) {
      const entry = this.entriesById.get(id);
      if (entry !== undefined && entry.category === "oneshot") jobs.push(this.loadAsset(entry));
    }
    const corridorImpulse = this.impulsesByZone.get("corridor");
    if (corridorImpulse !== undefined) jobs.push(this.loadImpulse(corridorImpulse));
    await Promise.all(jobs);
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

  private async applyZone(zone: ZoneId, epoch: number): Promise<void> {
    if (this.context === null || this.graph === null || this.appliedZone === zone) return;
    const entry = this.impulsesByZone.get(zone);
    if (entry === undefined) {
      this.report(`Impulse for zone "${zone}" is missing.`);
      return;
    }
    const context = this.context;
    const graph = this.graph;
    const cachedBuffer = this.impulseBuffers.get(zone);
    const buffer = cachedBuffer ?? await this.loadImpulse(entry);
    if (
      buffer === null
      || this.disposed
      || epoch !== this.playbackEpoch
      || this.requestedZone !== zone
      || this.context !== context
      || this.graph !== graph
      || this.appliedZone === zone
    ) return;

    crossfadeImpulse(
      graph,
      buffer,
      clamp01(entry.wet ?? DEFAULT_ZONE_WET_GAIN),
      context.currentTime,
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

  private startOneShot(
    id: string,
    source: AudioBufferSourceNodeLike,
    context: AudioContextLike,
  ): Promise<void> {
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
        source.start(context.currentTime);
      } catch (error) {
        this.reportError(`Could not start one-shot "${id}"`, error);
        this.finishOneShot(playback);
      }
    });
  }

  private startVoiceSource(
    entry: AudioManifestEntry,
    buffer: AudioBufferLike,
    source: AudioBufferSourceNodeLike,
    context: AudioContextLike,
  ): VoicePlaybackHandle | null {
    const decodedDurationSeconds = buffer.duration;
    const durationSeconds = (
      typeof decodedDurationSeconds === "number"
      && Number.isFinite(decodedDurationSeconds)
      && decodedDurationSeconds > 0
    )
      ? decodedDurationSeconds
      : Number.isFinite(entry.durationSeconds) && entry.durationSeconds > 0
        ? entry.durationSeconds
        : 0;
    const startedAt = context.currentTime;
    let resolveFinished: () => void = () => undefined;
    const finishedPromise = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });
    const playback = {} as VoicePlayback;
    Object.assign(playback, {
      id: entry.id,
      source,
      durationSeconds,
      startedAt,
      finishedPromise,
      resolveFinished,
      onError: () => {
        this.report(`Voice "${entry.id}" failed during playback.`);
        this.finishVoice(playback);
      },
      finished: false,
      finalPositionSeconds: 0,
    } satisfies VoicePlayback);

    source.onended = () => this.finishVoice(playback, false, true);
    source.addEventListener?.("error", playback.onError, { once: true });
    this.activeVoice = playback;
    this.setAmbientDuck(true);
    try {
      source.start(startedAt);
    } catch (error) {
      this.reportError(`Could not start voice "${entry.id}"`, error);
      this.finishVoice(playback);
      return null;
    }

    return {
      id: entry.id,
      durationSeconds,
      positionSeconds: () => this.voicePosition(playback),
      finished: finishedPromise,
      stop: () => this.finishVoice(playback, true),
    };
  }

  private async startHeartbeat(epoch: number): Promise<void> {
    if (
      this.heartbeatSource !== null
      || !this.heartbeatRequested
      || this.context === null
      || this.graph === null
    ) return;
    const entry = this.entriesById.get("heartbeat");
    if (entry === undefined || entry.category !== "oneshot") {
      this.report('Audio oneshot "heartbeat" is missing.');
      return;
    }
    const context = this.context;
    const graph = this.graph;
    const cachedBuffer = this.buffers.get(entry.id);
    const buffer = cachedBuffer ?? await this.loadAsset(entry);
    if (
      buffer === null
      || this.disposed
      || epoch !== this.playbackEpoch
      || !this.heartbeatRequested
      || this.heartbeatSource !== null
      || this.context !== context
      || this.graph !== graph
    ) return;

    try {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(graph.oneshotBus);
      source.onended = () => {
        if (this.heartbeatSource === source) this.heartbeatSource = null;
        safeDisconnect(source);
      };
      this.heartbeatSource = source;
      source.start(context.currentTime);
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

  private readyEnvironment(
    category: AudioManifestEntry["category"],
    id: string,
  ): { readonly context: AudioContextLike; readonly graph: AudioGraph } | null {
    if (this.disposed) {
      this.report(`Audio ${category} "${id}" was requested after cleanup.`);
      return null;
    }
    if (!this.preloadComplete || this.context === null || this.graph === null) {
      this.report(`Audio ${category} "${id}" was requested before audio was ready.`);
      return null;
    }
    return { context: this.context, graph: this.graph };
  }

  private loadAsset(entry: AudioManifestEntry): Promise<AudioBufferLike | null> {
    const ready = this.buffers.get(entry.id);
    if (ready !== undefined) return Promise.resolve(ready);
    const pending = this.assetLoads.get(entry.id);
    if (pending !== undefined) return pending;
    const generation = this.loadGeneration;
    const job = this.fetchAndDecode(entry.publicPath, `audio asset "${entry.id}"`)
      .then((buffer) => {
        if (this.disposed || generation !== this.loadGeneration) return null;
        this.failedAssets.delete(entry.id);
        this.buffers.set(entry.id, buffer);
        return buffer;
      })
      .catch((error: unknown) => {
        if (!this.disposed && generation === this.loadGeneration) {
          this.failedAssets.add(entry.id);
          this.reportError(`Could not load audio asset "${entry.id}"`, error);
        }
        return null;
      });
    this.assetLoads.set(entry.id, job);
    return job;
  }

  private loadImpulse(entry: ImpulseManifestEntry): Promise<AudioBufferLike | null> {
    const ready = this.impulseBuffers.get(entry.zone);
    if (ready !== undefined) return Promise.resolve(ready);
    const pending = this.impulseLoads.get(entry.zone);
    if (pending !== undefined) return pending;
    const generation = this.loadGeneration;
    const job = this.fetchAndDecode(entry.publicPath, `impulse "${entry.id}"`)
      .then((buffer) => {
        if (this.disposed || generation !== this.loadGeneration) return null;
        this.failedImpulses.delete(entry.zone);
        this.impulseBuffers.set(entry.zone, buffer);
        return buffer;
      })
      .catch((error: unknown) => {
        if (!this.disposed && generation === this.loadGeneration) {
          this.failedImpulses.add(entry.zone);
          this.reportError(`Could not load impulse "${entry.id}"`, error);
        }
        return null;
      });
    this.impulseLoads.set(entry.zone, job);
    return job;
  }

  private async fetchAndDecode(publicPath: string, label: string): Promise<AudioBufferLike> {
    assertLocalAudioPath(publicPath);
    const context = this.context;
    if (context === null) throw new Error("Web Audio context is unavailable");
    const response = await this.fetcher(publicPath);
    if (!response.ok) {
      const suffix = response.status === undefined ? "" : ` (${response.status})`;
      throw new Error(`Request failed${suffix}`);
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0) throw new Error(`${label} is empty`);
    try {
      return await context.decodeAudioData(bytes);
    } catch (error) {
      const detail = error instanceof Error && error.message ? `: ${error.message}` : "";
      throw new Error(`Could not decode ${label}${detail}`);
    }
  }

  private invalidatePendingWork(): void {
    this.playbackEpoch += 1;
    this.voiceRequest += 1;
    this.loadGeneration += 1;
    this.assetLoads.clear();
    this.impulseLoads.clear();
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

  private cancelActiveVoice(keepDucked = false): void {
    const playback = this.activeVoice;
    if (playback === null) return;
    this.finishVoice(playback, true, false, keepDucked);
  }

  private finishVoice(
    playback: VoicePlayback,
    stopNow = false,
    naturalFinish = false,
    keepDucked = false,
  ): void {
    if (playback.finished) return;
    playback.finalPositionSeconds = naturalFinish
      ? playback.durationSeconds
      : this.voicePosition(playback);
    playback.finished = true;
    playback.source.onended = null;
    playback.source.removeEventListener?.("error", playback.onError);
    if (stopNow) safeStop(playback.source);
    safeDisconnect(playback.source);
    if (this.activeVoice === playback) {
      this.activeVoice = null;
      if (!keepDucked) this.setAmbientDuck(false);
    }
    playback.resolveFinished();
  }

  private voicePosition(playback: VoicePlayback): number {
    if (playback.finished) return playback.finalPositionSeconds;
    const now = this.context?.currentTime ?? playback.startedAt;
    return Math.min(
      playback.durationSeconds,
      Math.max(0, now - playback.startedAt),
    );
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
