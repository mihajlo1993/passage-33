import { Controller } from "mind-ar/dist/mindar-image.prod.js";
import {
  ClampToEdgeWrapping,
  DoubleSide,
  Group,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
} from "three";

import {
  AR_SHEET_ASSETS,
  AR_TARGET_DATABASE,
  targetDatabaseBuffer,
} from "./assets";
import { isArFrameDue } from "./config";
import { startCappedMindArProcessing } from "./mindarFrameLoop";
import { effects, layout, motion } from "../tokens";

import type { CappedMindArProcessing } from "./mindarFrameLoop";
import type { MindArControllerUpdate } from "mind-ar/dist/mindar-image.prod.js";
import type { ArSheetAsset } from "./assets";
import type { ImageArSceneDefinition } from "./types";

const TARGET_DATABASE_SIZE = 2;

const sheet01VertexShader = /* glsl */ `
  uniform float uDisplacement;
  uniform float uPeel;
  uniform float uReach;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 transformed = position;
    float shoulderMask = smoothstep(0.0, 1.0, uv.y);
    transformed.z += uPeel * shoulderMask * uDisplacement;
    transformed.x += uReach * shoulderMask * uDisplacement;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

const alphaTextureFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec4 texel = texture2D(uMap, vUv);
    gl_FragColor = vec4(texel.rgb, texel.a * uOpacity);
  }
`;

export type ImageArFallbackCode =
  | "placeholder-target-database"
  | "placeholder-image-assets"
  | "invalid-target-database"
  | "invalid-image-assets"
  | "video-not-ready"
  | "video-not-playing"
  | "container-not-ready"
  | "image-decode-failed"
  | "webgl-unavailable"
  | "tracking-failed"
  | "runtime-disposed"
  | "initialization-failed";

export class ImageArFallbackError extends Error {
  readonly code: ImageArFallbackCode;

  constructor(
    code: ImageArFallbackCode,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "ImageArFallbackError";
    this.code = code;
  }
}

export interface ImageArRuntimeOptions {
  /** The stream and playback lifecycle remain owned by the caller. */
  readonly video: HTMLVideoElement;
  readonly container: HTMLElement;
  readonly scene: ImageArSceneDefinition;
  readonly onFound?: (scene: ImageArSceneDefinition) => void;
  readonly onLost?: (scene: ImageArSceneDefinition) => void;
  readonly onComplete?: (scene: ImageArSceneDefinition) => void;
  readonly onFallback?: (
    error: ImageArFallbackError,
    scene: ImageArSceneDefinition,
  ) => void;
}

export interface ImageArRuntime {
  readonly canvas: HTMLCanvasElement | null;
  readonly completed: boolean;
  start(): Promise<void>;
  dispose(): void;
}

interface PendingImageLoad {
  readonly image: HTMLImageElement;
  readonly reject: (reason: ImageArFallbackError) => void;
}

interface SheetVisual {
  readonly root: Group;
  readonly paperGeometry: PlaneGeometry;
  readonly overlayGeometry: PlaneGeometry;
  readonly paperMaterial: MeshBasicMaterial;
  readonly overlayMaterial: MeshBasicMaterial | ShaderMaterial;
  readonly paperTexture: Texture;
  readonly overlayTexture: Texture;
  readonly overlayPivot: Group;
}

function fallback(
  code: ImageArFallbackCode,
  message: string,
  cause?: unknown,
): ImageArFallbackError {
  return new ImageArFallbackError(code, message, { cause });
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothProgress(value: number): number {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function attemptCleanup(action: () => void): void {
  try {
    action();
  } catch {
    // Cleanup is best-effort, but one failed disposal must not leak the rest.
  }
}

function assertEmbeddedAssets(
  scene: ImageArSceneDefinition,
  sheetAsset: ArSheetAsset,
): void {
  if (AR_TARGET_DATABASE.placeholder) {
    throw fallback(
      "placeholder-target-database",
      "The embedded MindAR target database is a placeholder.",
    );
  }
  if (sheetAsset.placeholder) {
    throw fallback(
      "placeholder-image-assets",
      `The embedded ${scene.targetId} image assets are placeholders.`,
    );
  }
  if (
    !isPositiveFinite(sheetAsset.width)
    || !isPositiveFinite(sheetAsset.height)
    || !sheetAsset.paperDataUri.startsWith("data:image/")
    || !sheetAsset.overlayDataUri.startsWith("data:image/")
  ) {
    throw fallback(
      "invalid-image-assets",
      `The embedded ${scene.targetId} image assets are invalid.`,
    );
  }
}

function assertPlayingVideo(video: HTMLVideoElement): void {
  if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    || !isPositiveFinite(video.videoWidth)
    || !isPositiveFinite(video.videoHeight)
  ) {
    throw fallback(
      "video-not-ready",
      "Image tracking requires an app-owned video with current frame data.",
    );
  }
  if (video.paused || video.ended) {
    throw fallback(
      "video-not-playing",
      "Image tracking accepts an already-playing app-owned video.",
    );
  }
}

/**
 * MindAR's raw matrix is target-pixel based. This is the exact post-matrix
 * used by its Three adapter: center the target, then make one unit its width.
 */
export function createTargetNormalizationMatrix(
  targetWidth: number,
  targetHeight: number,
): Matrix4 {
  if (!isPositiveFinite(targetWidth) || !isPositiveFinite(targetHeight)) {
    throw fallback(
      "invalid-target-database",
      "MindAR returned non-positive target dimensions.",
    );
  }

  return new Matrix4().compose(
    new Vector3(targetWidth / 2, targetHeight / 2, 0),
    new Quaternion(),
    new Vector3(targetWidth, targetWidth, targetWidth),
  );
}

function configureTexture(texture: Texture): void {
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
}

function createSheetVisual(
  sceneDefinition: ImageArSceneDefinition,
  targetWidth: number,
  targetHeight: number,
  paperTexture: Texture,
  overlayTexture: Texture,
): SheetVisual {
  const aspect = targetHeight / targetWidth;
  const root = new Group();
  const paperGeometry = new PlaneGeometry(1, aspect);
  const overlayGeometry = sceneDefinition.targetId === "sheet01"
    ? new PlaneGeometry(1, aspect, 12, 18)
    : new PlaneGeometry(1, aspect);
  const paperMaterial = new MeshBasicMaterial({
    map: paperTexture,
    side: DoubleSide,
  });
  const paper = new Mesh(paperGeometry, paperMaterial);
  paper.frustumCulled = false;
  paper.renderOrder = 0;
  root.add(paper);

  let overlayMaterial: MeshBasicMaterial | ShaderMaterial;
  if (sceneDefinition.targetId === "sheet01") {
    overlayMaterial = new ShaderMaterial({
      uniforms: {
        uMap: { value: overlayTexture },
        uOpacity: { value: 0 },
        uPeel: { value: 0 },
        uReach: { value: 0 },
        uDisplacement: { value: effects.ar.wallUvDisplacement },
      },
      vertexShader: sheet01VertexShader,
      fragmentShader: alphaTextureFragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
  } else {
    overlayMaterial = new MeshBasicMaterial({
      map: overlayTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
    });
  }

  const overlay = new Mesh(overlayGeometry, overlayMaterial);
  overlay.frustumCulled = false;
  overlay.renderOrder = 1;

  const overlayPivot = new Group();
  const shoulderOffset = sceneDefinition.targetId === "sheet01" ? aspect / 2 : 0;
  overlayPivot.position.set(0, shoulderOffset, 1 / targetWidth);
  overlay.position.y = -shoulderOffset;
  overlayPivot.add(overlay);
  root.add(overlayPivot);

  return {
    root,
    paperGeometry,
    overlayGeometry,
    paperMaterial,
    overlayMaterial,
    paperTexture,
    overlayTexture,
    overlayPivot,
  };
}

function updateSheetMotion(
  visual: SheetVisual,
  sceneDefinition: ImageArSceneDefinition,
  elapsedMs: number,
): boolean {
  const durationMs = sceneDefinition.targetId === "sheet01"
    ? motion.eventMs.arImageReveal
    : motion.eventMs.arHerbReward;
  const progress = clamp01(elapsedMs / durationMs);
  const easedProgress = smoothProgress(progress);

  if (sceneDefinition.targetId === "sheet01") {
    const material = visual.overlayMaterial as ShaderMaterial;
    const peelProgress = easedProgress;
    const reachProgress = smoothProgress(progress * progress);
    material.uniforms.uPeel.value = peelProgress;
    material.uniforms.uReach.value = reachProgress;
    material.uniforms.uOpacity.value = easedProgress;
    const scale = 1
      + peelProgress * (effects.ar.wallPeelScale - 1)
      + reachProgress * (effects.ar.wallReachScale - effects.ar.wallPeelScale);
    visual.overlayPivot.scale.setScalar(scale);
    visual.overlayPivot.rotation.x = -reachProgress
      * effects.ar.wallShoulderDegrees
      * Math.PI
      / 180;
  } else {
    const material = visual.overlayMaterial as MeshBasicMaterial;
    const pulse = Math.sin(Math.PI * easedProgress);
    visual.overlayPivot.scale.setScalar(
      1 + pulse * (effects.ar.herbPulseScale - 1),
    );
    visual.overlayPivot.position.y = easedProgress * effects.ar.herbLiftMeters;
    material.opacity = easedProgress;
  }

  return progress >= 1;
}

function disposeSheetVisual(visual: SheetVisual | null): void {
  if (!visual) return;
  visual.root.removeFromParent();
  visual.paperGeometry.dispose();
  visual.overlayGeometry.dispose();
  visual.paperMaterial.dispose();
  visual.overlayMaterial.dispose();
  visual.paperTexture.dispose();
  visual.overlayTexture.dispose();
}

export function createImageArRuntime(
  options: ImageArRuntimeOptions,
): ImageArRuntime {
  const { container, scene: sceneDefinition, video } = options;
  const sheetAsset = AR_SHEET_ASSETS[sceneDefinition.targetId];
  const pendingImageLoads = new Set<PendingImageLoad>();
  const ownedTextures = new Set<Texture>();
  const originalVideoWidthAttribute = video.getAttribute("width");
  const originalVideoHeightAttribute = video.getAttribute("height");
  const threeScene = new Scene();
  const camera = new PerspectiveCamera();
  const rawTargetMatrix = new Matrix4();

  let animationFrame: number | null = null;
  let controller: Controller | null = null;
  let trackingLoop: CappedMindArProcessing | null = null;
  let renderer: WebGLRenderer | null = null;
  let visual: SheetVisual | null = null;
  let normalizationMatrix: Matrix4 | null = null;
  let startPromise: Promise<void> | null = null;
  let videoDimensionsSet = false;
  let disposed = false;
  let completeNotified = false;
  let fallbackNotified = false;
  let targetVisible = false;
  let lastRenderAtMs: number | null = null;
  let activeAnimationStartedAtMs: number | null = null;
  let accumulatedAnimationMs = 0;

  function nowMs(): number {
    return performance.now();
  }

  function notifyFallback(error: ImageArFallbackError): void {
    if (fallbackNotified) return;
    fallbackNotified = true;
    options.onFallback?.(error, sceneDefinition);
  }

  function ensureActive(): void {
    if (disposed) {
      throw fallback(
        "runtime-disposed",
        "The image AR runtime has already been disposed.",
      );
    }
  }

  function loadDataUriTexture(dataUri: string): Promise<Texture> {
    return new Promise<Texture>((resolve, reject) => {
      ensureActive();
      if (!dataUri.startsWith("data:image/")) {
        reject(fallback("invalid-image-assets", "AR texture is not embedded."));
        return;
      }

      const image: HTMLImageElement = document.createElement("img");
      image.decoding = "async";
      const pending: PendingImageLoad = {
        image,
        reject: (reason) => reject(reason),
      };
      pendingImageLoads.add(pending);

      image.onload = () => {
        pendingImageLoads.delete(pending);
        image.onload = null;
        image.onerror = null;
        if (disposed) {
          reject(fallback("runtime-disposed", "AR image loading was cancelled."));
          return;
        }
        const texture = new Texture(image);
        ownedTextures.add(texture);
        configureTexture(texture);
        resolve(texture);
      };
      image.onerror = () => {
        pendingImageLoads.delete(pending);
        image.onload = null;
        image.onerror = null;
        reject(fallback("image-decode-failed", "Embedded AR image could not be decoded."));
      };
      image.src = dataUri;
    });
  }

  function pauseTrackedAnimation(timestampMs: number): void {
    if (activeAnimationStartedAtMs === null) return;
    accumulatedAnimationMs += Math.max(0, timestampMs - activeAnimationStartedAtMs);
    activeAnimationStartedAtMs = null;
  }

  function resumeTrackedAnimation(timestampMs: number): void {
    if (activeAnimationStartedAtMs !== null || completeNotified) return;
    activeAnimationStartedAtMs = timestampMs;
  }

  function trackedAnimationElapsed(timestampMs: number): number {
    if (activeAnimationStartedAtMs === null) return accumulatedAnimationMs;
    return accumulatedAnimationMs + Math.max(0, timestampMs - activeAnimationStartedAtMs);
  }

  function handleControllerUpdate(update: MindArControllerUpdate): void {
    if (
      disposed
      || update.type !== "updateMatrix"
      || update.targetIndex !== sceneDefinition.targetIndex
      || !visual
      || !normalizationMatrix
    ) {
      return;
    }

    if (update.worldMatrix === null) {
      if (!targetVisible) return;
      targetVisible = false;
      visual.root.visible = false;
      pauseTrackedAnimation(nowMs());
      options.onLost?.(sceneDefinition);
      return;
    }

    rawTargetMatrix.fromArray(update.worldMatrix);
    visual.root.matrix.copy(rawTargetMatrix).multiply(normalizationMatrix);
    visual.root.matrixWorldNeedsUpdate = true;

    if (!targetVisible) {
      targetVisible = true;
      visual.root.visible = true;
      resumeTrackedAnimation(nowMs());
      options.onFound?.(sceneDefinition);
    }
  }

  function resize(): void {
    if (disposed || !renderer || !controller) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!isPositiveFinite(width) || !isPositiveFinite(height)) return;

    const projection = controller.getProjectionMatrix();
    if (
      projection.length !== 16
      || !isPositiveFinite(projection[5])
      || !Number.isFinite(projection[10])
      || !Number.isFinite(projection[14])
    ) {
      return;
    }

    const containerRatio = width / height;
    const inputRatio = controller.inputWidth / controller.inputHeight;
    const displayedVideoHeight = inputRatio > containerRatio
      ? height
      : width / controller.inputWidth * controller.inputHeight;
    const fovAdjust = height / displayedVideoHeight;
    const fovRadians = 2 * Math.atan(1 / projection[5] * fovAdjust);
    const near = projection[14] / (projection[10] - 1);
    const far = projection[14] / (projection[10] + 1);

    camera.fov = fovRadians * 180 / Math.PI;
    camera.near = near;
    camera.far = far;
    camera.aspect = containerRatio;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function renderFrame(timestampMs: number): void {
    if (disposed) return;
    animationFrame = window.requestAnimationFrame(renderFrame);
    if (!renderer || !visual || !isArFrameDue(timestampMs, lastRenderAtMs)) {
      return;
    }

    lastRenderAtMs = timestampMs;
    if (targetVisible && !completeNotified) {
      const finished = updateSheetMotion(
        visual,
        sceneDefinition,
        trackedAnimationElapsed(timestampMs),
      );
      if (finished) {
        completeNotified = true;
        pauseTrackedAnimation(timestampMs);
        options.onComplete?.(sceneDefinition);
      }
    }
    if (!disposed && renderer) {
      renderer.render(threeScene, camera);
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    targetVisible = false;
    activeAnimationStartedAtMs = null;

    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    window.removeEventListener("resize", resize);

    for (const pending of pendingImageLoads) {
      pending.image.onload = null;
      pending.image.onerror = null;
      pending.image.removeAttribute("src");
      pending.reject(fallback("runtime-disposed", "AR image loading was cancelled."));
    }
    pendingImageLoads.clear();

    if (trackingLoop) {
      const ownedTrackingLoop = trackingLoop;
      trackingLoop = null;
      attemptCleanup(() => ownedTrackingLoop.stop());
    }

    if (controller) {
      const ownedController = controller;
      controller = null;
      ownedController.onUpdate = null;
      attemptCleanup(() => ownedController.stopProcessVideo());
      attemptCleanup(() => ownedController.dispose());
    }

    const ownedVisual = visual;
    visual = null;
    attemptCleanup(() => disposeSheetVisual(ownedVisual));
    for (const texture of ownedTextures) {
      attemptCleanup(() => texture.dispose());
    }
    ownedTextures.clear();
    normalizationMatrix = null;
    threeScene.clear();

    if (videoDimensionsSet) {
      videoDimensionsSet = false;
      if (originalVideoWidthAttribute === null) {
        video.removeAttribute("width");
      } else {
        video.setAttribute("width", originalVideoWidthAttribute);
      }
      if (originalVideoHeightAttribute === null) {
        video.removeAttribute("height");
      } else {
        video.setAttribute("height", originalVideoHeightAttribute);
      }
    }

    if (renderer) {
      const ownedRenderer = renderer;
      renderer = null;
      attemptCleanup(() => ownedRenderer.setAnimationLoop(null));
      attemptCleanup(() => ownedRenderer.domElement.remove());
      attemptCleanup(() => ownedRenderer.renderLists.dispose());
      attemptCleanup(() => ownedRenderer.dispose());
      attemptCleanup(() => ownedRenderer.forceContextLoss());
    }
  }

  async function initialize(): Promise<void> {
    ensureActive();
    assertEmbeddedAssets(sceneDefinition, sheetAsset);
    assertPlayingVideo(video);
    if (
      !isPositiveFinite(container.clientWidth)
      || !isPositiveFinite(container.clientHeight)
    ) {
      throw fallback(
        "container-not-ready",
        "Image AR requires a visible, measured container.",
      );
    }

    videoDimensionsSet = true;
    video.width = video.videoWidth;
    video.height = video.videoHeight;

    const [paperTexture, overlayTexture] = await Promise.all([
      loadDataUriTexture(sheetAsset.paperDataUri),
      loadDataUriTexture(sheetAsset.overlayDataUri),
    ]);
    ensureActive();

    try {
      renderer = new WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
      });
    } catch (error) {
      throw fallback("webgl-unavailable", "WebGL renderer creation failed.", error);
    }

    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, effects.ar.renderPixelRatioMax),
    );
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = `${layout.spacingPx.none}px`;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.pointerEvents = "none";
    container.appendChild(renderer.domElement);

    controller = new Controller({
      inputWidth: video.videoWidth,
      inputHeight: video.videoHeight,
      maxTrack: 1,
      debugMode: false,
      onUpdate: handleControllerUpdate,
    });
    controller.interestedTargetIndex = sceneDefinition.targetIndex;

    let targetDimensions: Array<[number, number]>;
    try {
      const targets = controller.addImageTargetsFromBuffer(targetDatabaseBuffer());
      targetDimensions = targets.dimensions;
    } catch (error) {
      throw fallback(
        "invalid-target-database",
        "The embedded MindAR target database could not be decoded.",
        error,
      );
    }

    if (
      targetDimensions.length !== TARGET_DATABASE_SIZE
      || !targetDimensions[sceneDefinition.targetIndex]
    ) {
      throw fallback(
        "invalid-target-database",
        "MindAR target order or target count is invalid.",
      );
    }
    const [targetWidth, targetHeight] = targetDimensions[sceneDefinition.targetIndex];
    normalizationMatrix = createTargetNormalizationMatrix(targetWidth, targetHeight);
    visual = createSheetVisual(
      sceneDefinition,
      targetWidth,
      targetHeight,
      paperTexture,
      overlayTexture,
    );
    ownedTextures.delete(paperTexture);
    ownedTextures.delete(overlayTexture);
    visual.root.visible = false;
    visual.root.matrixAutoUpdate = false;
    threeScene.add(visual.root);

    resize();
    controller.dummyRun(video);
    ensureActive();
    try {
      trackingLoop = startCappedMindArProcessing({
        controller,
        input: video,
        onError: (error) => {
          if (disposed) return;
          const typedError = fallback(
            "tracking-failed",
            "Image tracking stopped after a processing failure.",
            error,
          );
          dispose();
          notifyFallback(typedError);
        },
      });
    } catch (error) {
      throw fallback(
        "tracking-failed",
        "Image tracking could not start.",
        error,
      );
    }
    window.addEventListener("resize", resize);
    animationFrame = window.requestAnimationFrame(renderFrame);
  }

  function start(): Promise<void> {
    if (startPromise) return startPromise;
    startPromise = initialize().catch((error: unknown) => {
      const typedError = error instanceof ImageArFallbackError
        ? error
        : fallback(
            "initialization-failed",
            "Image AR initialization failed.",
            error,
          );
      dispose();
      notifyFallback(typedError);
      throw typedError;
    });
    return startPromise;
  }

  return {
    get canvas(): HTMLCanvasElement | null {
      return renderer?.domElement ?? null;
    },
    get completed(): boolean {
      return completeNotified;
    },
    start,
    dispose,
  };
}

export async function startImageArRuntime(
  options: ImageArRuntimeOptions,
): Promise<ImageArRuntime> {
  const runtime = createImageArRuntime(options);
  await runtime.start();
  return runtime;
}
