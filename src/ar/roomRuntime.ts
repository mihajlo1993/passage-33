/// <reference types="webxr" />

import * as THREE from "three";

import { colours, effects, motion } from "../tokens";
import { AR_CREATURE_ASSET } from "./assets";
import {
  ROOM_MONSTER_SCALE_METERS,
  WEBXR_SESSION_MODE,
  createRoomWebXrSessionInit,
  isArFrameDue,
} from "./config";
import type { RoomArPlacement } from "./types";

const EMBEDDED_PNG_PREFIX = "data:image/png;base64,";
const FALLEN_ROTATION_RADIANS = THREE.MathUtils.degToRad(
  effects.ar.monsterCollapseDegrees,
);

export type RoomXrRuntimePhase =
  | "idle"
  | "starting"
  | "tracking"
  | "placed"
  | "collapsing"
  | "collapsed"
  | "ended"
  | "failed"
  | "disposed";

export type RoomXrRuntimeErrorCode =
  | "webxr-unavailable"
  | "session-rejected"
  | "hit-test-unavailable"
  | "creature-asset-invalid"
  | "creature-asset-failed"
  | "runtime-failed";

export class RoomXrRuntimeError extends Error {
  readonly code: RoomXrRuntimeErrorCode;

  constructor(code: RoomXrRuntimeErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "RoomXrRuntimeError";
    this.code = code;
  }
}

export interface RoomXrRuntimeSnapshot {
  readonly phase: RoomXrRuntimePhase;
  readonly candidatePlacement: RoomArPlacement | null;
  readonly placement: RoomArPlacement | null;
}

export interface RoomXrRuntimeOptions {
  /** Element that owns the Three WebGL canvas for this session. */
  readonly mount: HTMLElement;
  /** The same physical-screen overlay supplied as WebXR's DOM overlay root. */
  readonly overlayRoot: Element;
  readonly onPhaseChange?: (phase: RoomXrRuntimePhase) => void;
  readonly onCandidateChange?: (placement: RoomArPlacement | null) => void;
  readonly onPlaced?: (placement: RoomArPlacement) => void;
  readonly onSessionEnded?: () => void;
  readonly onError?: (error: RoomXrRuntimeError) => void;
}

export interface RoomXrRuntime {
  readonly phase: RoomXrRuntimePhase;
  /**
   * Requests `immersive-ar`. Call this directly from an explicit user gesture;
   * constructing the runtime never opens a session.
   */
  start(): Promise<void>;
  /** Locks the current floor hit. Subsequent calls return the first placement. */
  place(): RoomArPlacement | null;
  /** Starts a bottom-pivot fall while leaving the creature in the scene. */
  collapse(): boolean;
  snapshot(): RoomXrRuntimeSnapshot;
  dispose(): Promise<void>;
}

interface PendingImageTexture {
  readonly promise: Promise<THREE.Texture>;
  cancel(): void;
}

export function isEmbeddedCreatureDataUri(value: string): boolean {
  return value.startsWith(EMBEDDED_PNG_PREFIX)
    && value.length > EMBEDDED_PNG_PREFIX.length;
}

/** Yaw for a +Z-facing plane to look at the viewer without pitching. */
export function billboardYawRadians(
  objectXMeters: number,
  objectZMeters: number,
  viewerXMeters: number,
  viewerZMeters: number,
): number {
  const xDelta = viewerXMeters - objectXMeters;
  const zDelta = viewerZMeters - objectZMeters;
  if (xDelta === 0 && zDelta === 0) return 0;
  return Math.atan2(xDelta, zDelta);
}

/** Rejects wall-like hit poses while allowing either floor-normal direction. */
export function isHorizontalFloorHitMatrix(matrix: ArrayLike<number>): boolean {
  const normalY = matrix[5];
  return typeof normalY === "number"
    && Number.isFinite(normalY)
    && Math.abs(normalY) >= Math.SQRT1_2;
}

/** Deterministic collapse progress; duration remains owned by the token table. */
export function roomCollapseProgress(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(1, elapsedMs / motion.eventMs.arCollapseDuration);
}

export async function isRoomXrSupported(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.xr) return false;

  try {
    return await navigator.xr.isSessionSupported(WEBXR_SESSION_MODE);
  } catch {
    return false;
  }
}

function freezePlacement(placement: RoomArPlacement): RoomArPlacement {
  return Object.freeze({ ...placement });
}

function placementsDiffer(
  previous: RoomArPlacement | null,
  next: RoomArPlacement | null,
): boolean {
  if (previous === null || next === null) return previous !== next;

  return previous.xMeters !== next.xMeters
    || previous.yMeters !== next.yMeters
    || previous.zMeters !== next.zMeters
    || previous.yawRadians !== next.yawRadians;
}

function normalizeRuntimeError(
  error: unknown,
  fallbackCode: RoomXrRuntimeErrorCode,
  fallbackMessage: string,
): RoomXrRuntimeError {
  if (error instanceof RoomXrRuntimeError) return error;
  return new RoomXrRuntimeError(fallbackCode, fallbackMessage, error);
}

function createCreatureTexture(): PendingImageTexture {
  const dataUri = AR_CREATURE_ASSET.dataUri;
  if (!isEmbeddedCreatureDataUri(dataUri)) {
    const error = new RoomXrRuntimeError(
      "creature-asset-invalid",
      "The room creature must be an embedded PNG data URI.",
    );
    return {
      promise: Promise.reject(error),
      cancel() {},
    };
  }

  let image: HTMLImageElement | null = new Image();
  let rejectPromise: ((error: RoomXrRuntimeError) => void) | null = null;
  let settled = false;

  const promise = new Promise<THREE.Texture>((resolve, reject) => {
    rejectPromise = reject;
    if (!image) return;

    image.decoding = "async";
    image.onload = () => {
      if (!image || settled) return;
      settled = true;
      const texture = new THREE.Texture(image);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      image.onload = null;
      image.onerror = null;
      image = null;
      resolve(texture);
    };
    image.onerror = () => {
      if (settled) return;
      settled = true;
      image = null;
      reject(new RoomXrRuntimeError(
        "creature-asset-failed",
        "The embedded room creature could not be decoded.",
      ));
    };
    image.src = dataUri;
  });

  return {
    promise,
    cancel() {
      if (settled) return;
      settled = true;
      if (image) {
        image.onload = null;
        image.onerror = null;
        image = null;
      }
      rejectPromise?.(new RoomXrRuntimeError(
        "runtime-failed",
        "Room AR was disposed before the embedded creature decoded.",
      ));
      rejectPromise = null;
    },
  };
}

export function createRoomXrRuntime(
  options: RoomXrRuntimeOptions,
): RoomXrRuntime {
  let phase: RoomXrRuntimePhase = "idle";
  let candidatePlacement: RoomArPlacement | null = null;
  let placement: RoomArPlacement | null = null;
  let collapseStartedAtMs: number | null = null;
  let lastXrTimestampMs: number | null = null;
  let startPromise: Promise<void> | null = null;
  let disposePromise: Promise<void> | null = null;
  let disposedRequested = false;
  let sessionEnded = false;
  let resourcesReleased = false;
  let suppressEndNotification = false;

  let session: XRSession | null = null;
  let referenceSpace: XRReferenceSpace | null = null;
  let hitTestSource: XRHitTestSource | null = null;
  let pendingImageTexture: PendingImageTexture | null = null;

  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let reticle: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null;
  let reticleGeometry: THREE.RingGeometry | null = null;
  let reticleMaterial: THREE.MeshBasicMaterial | null = null;
  let creatureGroup: THREE.Group | null = null;
  let creatureGeometry: THREE.PlaneGeometry | null = null;
  let creatureMaterial: THREE.MeshBasicMaterial | null = null;
  let creatureTexture: THREE.Texture | null = null;

  function setPhase(next: RoomXrRuntimePhase): void {
    if (phase === next) return;
    phase = next;
    options.onPhaseChange?.(next);
  }

  function setCandidate(next: RoomArPlacement | null): void {
    if (!placementsDiffer(candidatePlacement, next)) return;
    candidatePlacement = next === null ? null : freezePlacement(next);
    options.onCandidateChange?.(candidatePlacement);
  }

  function assertStartupActive(message: string): void {
    if (!disposedRequested && !sessionEnded) return;
    throw new RoomXrRuntimeError("runtime-failed", message);
  }

  function resizeRenderer(): void {
    if (!renderer || renderer.xr.isPresenting) return;
    const width = Math.max(1, options.mount.clientWidth);
    const height = Math.max(1, options.mount.clientHeight);
    renderer.setSize(width, height, false);
  }

  function stopRuntimeWork(): void {
    window.removeEventListener("resize", resizeRenderer);
    renderer?.setAnimationLoop(null);
    pendingImageTexture?.cancel();
    pendingImageTexture = null;

    if (hitTestSource) {
      hitTestSource.cancel();
      hitTestSource = null;
    }
    setCandidate(null);
  }

  function releaseGraphics(): void {
    if (resourcesReleased) return;
    resourcesReleased = true;
    stopRuntimeWork();

    if (session) {
      session.removeEventListener("end", handleSessionEnd);
    }

    if (scene && reticle) scene.remove(reticle);
    if (scene && creatureGroup) scene.remove(creatureGroup);
    reticleGeometry?.dispose();
    reticleMaterial?.dispose();
    creatureGeometry?.dispose();
    creatureMaterial?.dispose();
    creatureTexture?.dispose();

    if (renderer) {
      const canvas = renderer.domElement;
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    }

    referenceSpace = null;
    reticle = null;
    reticleGeometry = null;
    reticleMaterial = null;
    creatureGroup = null;
    creatureGeometry = null;
    creatureMaterial = null;
    creatureTexture = null;
    camera = null;
    scene = null;
    renderer = null;
    session = null;
  }

  function handleSessionEnd(): void {
    if (sessionEnded) return;
    sessionEnded = true;
    stopRuntimeWork();

    // Startup may still own resources across an await. It is responsible for
    // observing sessionEnded and unwinding before graphics become immutable.
    const pendingStart = startPromise;
    if (pendingStart) {
      void pendingStart.catch(() => undefined).finally(releaseGraphics);
    } else {
      releaseGraphics();
    }

    if (disposedRequested) {
      setPhase("disposed");
      return;
    }

    if (suppressEndNotification) return;
    setPhase("ended");
    options.onSessionEnded?.();
  }

  function renderFrame(timestampMs: number, frame: XRFrame): void {
    if (
      disposedRequested
      || !renderer
      || !scene
      || !camera
      || !referenceSpace
      || !isArFrameDue(timestampMs, lastXrTimestampMs)
    ) {
      return;
    }

    lastXrTimestampMs = timestampMs;

    if (!placement && hitTestSource) {
      const hit = frame.getHitTestResults(hitTestSource).find((result) => {
        const pose = result.getPose(referenceSpace as XRReferenceSpace);
        return pose ? isHorizontalFloorHitMatrix(pose.transform.matrix) : false;
      });
      const hitPose = hit?.getPose(referenceSpace);
      const viewerPose = frame.getViewerPose(referenceSpace);

      if (hitPose && viewerPose) {
        const floorPosition = hitPose.transform.position;
        const viewerPosition = viewerPose.transform.position;
        const nextCandidate = {
          xMeters: floorPosition.x,
          yMeters: floorPosition.y,
          zMeters: floorPosition.z,
          yawRadians: billboardYawRadians(
            floorPosition.x,
            floorPosition.z,
            viewerPosition.x,
            viewerPosition.z,
          ),
        } satisfies RoomArPlacement;

        setCandidate(nextCandidate);
        if (reticle) {
          reticle.matrix.fromArray(hitPose.transform.matrix);
          reticle.visible = true;
        }
      } else {
        setCandidate(null);
        if (reticle) reticle.visible = false;
      }
    }

    if (collapseStartedAtMs !== null && creatureGroup) {
      const progress = roomCollapseProgress(timestampMs - collapseStartedAtMs);
      creatureGroup.rotation.x = FALLEN_ROTATION_RADIANS * progress;
      if (progress === 1) setPhase("collapsed");
    }

    renderer.render(scene, camera);
  }

  async function startInternal(): Promise<void> {
    if (disposedRequested) {
      throw new RoomXrRuntimeError(
        "runtime-failed",
        "A disposed room AR runtime cannot be started.",
      );
    }

    const xr = typeof navigator === "undefined" ? undefined : navigator.xr;
    if (!xr) {
      const error = new RoomXrRuntimeError(
        "webxr-unavailable",
        "Immersive AR is unavailable on this device.",
      );
      setPhase("failed");
      options.onError?.(error);
      throw error;
    }

    setPhase("starting");
    assertStartupActive(
      "Room AR was disposed before its immersive session request began.",
    );

    try {
      // This is deliberately the first asynchronous browser operation. The
      // caller's user activation is still live when the immersive request runs.
      const requestedSession = await xr.requestSession(
        WEBXR_SESSION_MODE,
        createRoomWebXrSessionInit(options.overlayRoot) as XRSessionInit,
      );

      if (disposedRequested || sessionEnded) {
        suppressEndNotification = true;
        await requestedSession.end();
        throw new RoomXrRuntimeError(
          "runtime-failed",
          "Room AR was disposed while its immersive session was opening.",
        );
      }

      session = requestedSession;
      requestedSession.addEventListener("end", handleSessionEnd);
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        depth: true,
        stencil: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearAlpha(0);
      renderer.setPixelRatio(Math.min(
        window.devicePixelRatio,
        effects.ar.renderPixelRatioMax,
      ));
      resizeRenderer();
      options.mount.append(renderer.domElement);

      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType("local");
      await renderer.xr.setSession(requestedSession);
      assertStartupActive(
        "The immersive session ended during renderer setup.",
      );
      const acquiredReferenceSpace = renderer.xr.getReferenceSpace()
        ?? await requestedSession.requestReferenceSpace("local");
      assertStartupActive(
        "The immersive session ended during reference-space setup.",
      );
      referenceSpace = acquiredReferenceSpace;

      const viewerSpace = await requestedSession.requestReferenceSpace("viewer");
      assertStartupActive(
        "The immersive session ended during viewer-space setup.",
      );
      const hitTestRequest = requestedSession.requestHitTestSource?.({
        space: viewerSpace,
        entityTypes: ["plane"],
      });
      if (!hitTestRequest) {
        throw new RoomXrRuntimeError(
          "hit-test-unavailable",
          "The immersive session did not provide floor hit testing.",
        );
      }
      const acquiredHitTestSource = await hitTestRequest;
      if (disposedRequested || sessionEnded) acquiredHitTestSource.cancel();
      assertStartupActive(
        "The immersive session ended during floor-tracking setup.",
      );
      hitTestSource = acquiredHitTestSource;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera();

      reticleGeometry = new THREE.RingGeometry(
        ROOM_MONSTER_SCALE_METERS / 24,
        ROOM_MONSTER_SCALE_METERS / 18,
        24,
      );
      reticleGeometry.rotateX(-Math.PI / 2);
      reticleMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colours.boneDim),
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      });
      reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);

      const pendingTexture = createCreatureTexture();
      pendingImageTexture = pendingTexture;
      const decodedTexture = await pendingTexture.promise;
      if (pendingImageTexture === pendingTexture) pendingImageTexture = null;
      if (disposedRequested || sessionEnded) decodedTexture.dispose();
      assertStartupActive(
        "Room AR was disposed during creature setup.",
      );
      creatureTexture = decodedTexture;

      const creatureWidthMeters = ROOM_MONSTER_SCALE_METERS
        * (AR_CREATURE_ASSET.width / AR_CREATURE_ASSET.height);
      creatureGeometry = new THREE.PlaneGeometry(
        creatureWidthMeters,
        ROOM_MONSTER_SCALE_METERS,
      );
      creatureGeometry.translate(0, ROOM_MONSTER_SCALE_METERS / 2, 0);
      creatureMaterial = new THREE.MeshBasicMaterial({
        map: creatureTexture,
        transparent: true,
        alphaTest: 0.02,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const creature = new THREE.Mesh(creatureGeometry, creatureMaterial);
      creature.frustumCulled = false;
      creatureGroup = new THREE.Group();
      creatureGroup.visible = false;
      creatureGroup.add(creature);
      scene.add(creatureGroup);

      window.addEventListener("resize", resizeRenderer);
      renderer.setAnimationLoop(renderFrame);
      setPhase("tracking");
    } catch (caught) {
      const fallbackCode = session
        ? "runtime-failed"
        : "session-rejected";
      const error = normalizeRuntimeError(
        caught,
        fallbackCode,
        fallbackCode === "session-rejected"
          ? "The immersive AR session was rejected."
          : "The room AR runtime failed to initialize.",
      );

      suppressEndNotification = true;
      stopRuntimeWork();
      const activeSession = session;
      if (activeSession && !sessionEnded) {
        try {
          await activeSession.end();
        } catch {
          // The graphics below are still released if the browser already ended.
        }
      }
      releaseGraphics();

      if (!disposedRequested) {
        setPhase("failed");
        options.onError?.(error);
      }
      throw error;
    }
  }

  function place(): RoomArPlacement | null {
    if (placement) return placement;
    if (!candidatePlacement || !creatureGroup || disposedRequested) return null;

    placement = freezePlacement(candidatePlacement);
    creatureGroup.position.set(
      placement.xMeters,
      placement.yMeters,
      placement.zMeters,
    );
    creatureGroup.rotation.set(0, placement.yawRadians, 0);
    creatureGroup.visible = true;
    if (reticle) reticle.visible = false;
    setCandidate(null);
    setPhase("placed");
    options.onPlaced?.(placement);
    return placement;
  }

  function collapse(): boolean {
    if (!placement || !creatureGroup || disposedRequested) return false;
    if (collapseStartedAtMs !== null) return true;

    collapseStartedAtMs = lastXrTimestampMs ?? performance.now();
    creatureGroup.visible = true;
    setPhase("collapsing");
    return true;
  }

  async function disposeInternal(): Promise<void> {
    if (disposedRequested) return;
    disposedRequested = true;
    suppressEndNotification = true;
    stopRuntimeWork();

    const activeSession = session;
    if (activeSession && !sessionEnded) {
      try {
        await activeSession.end();
      } catch {
        // Cleanup remains deterministic when the browser has already ended it.
      }
    }

    // A pending requestSession cannot be cancelled. Wait for startup to either
    // reject or immediately end its late session before another camera opens.
    const pendingStart = startPromise;
    if (pendingStart) {
      try {
        await pendingStart;
      } catch {
        // Disposal owns the terminal phase; startup still reports to its caller.
      }
    }

    releaseGraphics();
    setPhase("disposed");
  }

  return {
    get phase(): RoomXrRuntimePhase {
      return phase;
    },
    start(): Promise<void> {
      startPromise ??= startInternal();
      return startPromise;
    },
    place,
    collapse,
    snapshot(): RoomXrRuntimeSnapshot {
      return Object.freeze({
        phase,
        candidatePlacement,
        placement,
      });
    },
    dispose(): Promise<void> {
      disposePromise ??= disposeInternal();
      return disposePromise;
    },
  };
}
