"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { colours, effects, motion } from "../tokens";
import {
  getVHSRenderProfile,
  isVHSFrameDue,
  sampleVHSFrameGeometry,
} from "./model";
import type { VHSControls, VHSLayerProps } from "./types";
import { VHSContext } from "./useVHS";

const DAMAGE_FILTER_ID = "vhs-damage-spike";
const FRAME_SEED = 0x7a31c9e5;

function clampDuration(durationMs: number): number {
  if (!Number.isFinite(durationMs)) return 1;
  return Math.max(1, Math.floor(durationMs));
}

function createRandom(seed = FRAME_SEED): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

function writeRenderProfile(
  stage: HTMLElement,
  overlay: HTMLCanvasElement | null,
  intensity: number,
  disabled: boolean,
): void {
  const profile = getVHSRenderProfile(intensity, disabled);
  stage.style.setProperty("--vhs-saturation", profile.saturation.toFixed(3));
  stage.style.setProperty("--vhs-contrast", profile.contrast.toFixed(3));
  stage.style.setProperty("--vhs-blur", profile.blurPx.toFixed(3) + "px");
  stage.style.setProperty(
    "--vhs-chroma",
    profile.chromaOffsetPx.toFixed(3) + "px",
  );
  overlay?.style.setProperty(
    "--vhs-canvas-opacity",
    profile.canvasOpacity.toFixed(3),
  );
}

export function VHSLayer({
  children,
  disabled: permanentlyDisabled,
}: VHSLayerProps) {
  const [suspended, setSuspended] = useState(false);
  const disabled = permanentlyDisabled || suspended;
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timecodeElementRef = useRef<HTMLOutputElement>(null);
  const intensityRef = useRef(0.15);
  const timecodeRef = useRef<string | null>(null);
  const timersRef = useRef<{
    glitch: number | null;
    drop: number | null;
    roll: number | null;
  }>({ glitch: null, drop: null, roll: null });

  const controls = useMemo<VHSControls>(() => ({
    setIntensity(intensity) {
      const next = Number.isFinite(intensity)
        ? Math.min(1, Math.max(0, intensity))
        : 0;
      intensityRef.current = next;
      const stage = stageRef.current;
      if (stage) writeRenderProfile(stage, canvasRef.current, next, disabled);
    },
    glitch(durationMs) {
      const stage = stageRef.current;
      if (disabled || !stage) return;
      if (timersRef.current.glitch !== null) {
        window.clearTimeout(timersRef.current.glitch);
      }
      stage.dataset.glitch = "true";
      timersRef.current.glitch = window.setTimeout(() => {
        delete stage.dataset.glitch;
        timersRef.current.glitch = null;
      }, clampDuration(durationMs));
    },
    dropFrames(durationMs) {
      const stage = stageRef.current;
      if (disabled || !stage) return;
      if (timersRef.current.drop !== null) {
        window.clearTimeout(timersRef.current.drop);
      }
      stage.dataset.drop = "true";
      timersRef.current.drop = window.setTimeout(() => {
        delete stage.dataset.drop;
        timersRef.current.drop = null;
      }, clampDuration(durationMs));
    },
    setTimecode(timecode) {
      timecodeRef.current = timecode;
      const output = timecodeElementRef.current;
      if (!output) return;
      output.textContent = timecode ?? "";
      output.dataset.active = String(!disabled && timecode !== null);
    },
    suspend: setSuspended,
  }), [disabled]);

  useEffect(() => {
    const stage = stageRef.current;
    const output = timecodeElementRef.current;
    if (!stage || !output) return;

    writeRenderProfile(stage, canvasRef.current, intensityRef.current, disabled);
    stage.dataset.vhsDisabled = String(disabled);
    output.dataset.active = String(!disabled && timecodeRef.current !== null);
    if (disabled) {
      delete stage.dataset.glitch;
      delete stage.dataset.drop;
      delete stage.dataset.roll;
      stage.style.setProperty("--vhs-jitter-y", "0px");
      const timers = timersRef.current;
      if (timers.glitch !== null) window.clearTimeout(timers.glitch);
      if (timers.drop !== null) window.clearTimeout(timers.drop);
      if (timers.roll !== null) window.clearTimeout(timers.roll);
      timers.glitch = null;
      timers.drop = null;
      timers.roll = null;
    }
  }, [disabled]);

  useEffect(() => () => {
    const timers = timersRef.current;
    if (timers.glitch !== null) window.clearTimeout(timers.glitch);
    if (timers.drop !== null) window.clearTimeout(timers.drop);
    if (timers.roll !== null) window.clearTimeout(timers.roll);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const output = timecodeElementRef.current;
    if (disabled || !canvas || !stage || !output) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const scanlines = document.createElement("canvas");
    const grain = document.createElement("canvas");
    const scanlineContext = scanlines.getContext("2d", { alpha: true });
    let lastJitter = Number.NaN;
    const grainContext = grain.getContext("2d", { alpha: true });
    if (!scanlineContext || !grainContext) return;

    const random = createRandom();
    let animationFrame = 0;
    let renderedFrames = 0;
    let lastRenderedAt: number | null = null;
    let grainImage: ImageData | null = null;
    let visible = document.visibilityState !== "hidden";
    let canvasPixelsPerCssPixel = 1;

    const buildStaticLayers = () => {
      const deviceScale =
        Math.max(1, window.devicePixelRatio || 1) * effects.vhs.renderScale;
      const width = Math.max(1, Math.round(window.innerWidth * deviceScale));
      const height = Math.max(1, Math.round(window.innerHeight * deviceScale));

      canvas.width = width;
      canvas.height = height;
      scanlines.width = width;
      scanlines.height = height;
      grain.width = width;
      grain.height = height;
      canvasPixelsPerCssPixel = height / Math.max(1, window.innerHeight);
      grainImage = grainContext.createImageData(width, height);

      context.imageSmoothingEnabled = false;
      scanlineContext.imageSmoothingEnabled = false;
      grainContext.imageSmoothingEnabled = false;
      scanlineContext.clearRect(0, 0, width, height);
      scanlineContext.fillStyle = colours.bone;
      scanlineContext.globalAlpha = 0.17;
      const step = Math.max(
        1,
        Math.round(effects.vhs.scanlineStepPx * canvasPixelsPerCssPixel),
      );
      for (let y = 0; y < height; y += step) {
        scanlineContext.fillRect(0, y, width, 1);
      }
      scanlineContext.globalAlpha = 1;
    };

    const regenerateGrain = () => {
      if (!grainImage) return;
      const pixels = grainImage.data;
      for (let offset = 0; offset < pixels.length; offset += 4) {
        const luminance = 88 + Math.floor(random() * 96);
        pixels[offset] = luminance;
        pixels[offset + 1] = luminance;
        pixels[offset + 2] = luminance;
        pixels[offset + 3] = 24 + Math.floor(random() * 42);
      }
      grainContext.putImageData(grainImage, 0, 0);
    };

    const drawDropouts = (intensity: number, dropoutHeightCssPx: number) => {
      const dropoutCount = 1 + Math.floor(intensity * 2);
      for (let index = 0; index < dropoutCount; index += 1) {
        const height = Math.max(
          1,
          Math.round(dropoutHeightCssPx * canvasPixelsPerCssPixel),
        );
        const y = Math.floor(random() * Math.max(1, canvas.height - height));
        const x = Math.floor(random() * canvas.width * 0.45);
        const width = Math.max(
          1,
          Math.floor(canvas.width * (0.28 + random() * 0.7)),
        );
        context.globalAlpha = 0.12 + intensity * 0.24;
        context.fillStyle = random() > 0.5
          ? colours.chromaCyan
          : colours.bone;
        context.fillRect(x, y, Math.min(width, canvas.width - x), height);
      }
    };

    const drawTornBottom = (intensity: number, tearHeightCssPx: number) => {
      const tearHeight = Math.max(
        1,
        Math.round(tearHeightCssPx * canvasPixelsPerCssPixel),
      );
      const top = Math.max(0, canvas.height - tearHeight);
      context.globalAlpha = 0.15 + intensity * 0.32;
      for (let y = top; y < canvas.height; y += 1) {
        const segmentCount = 3 + Math.floor(random() * 6);
        for (let segment = 0; segment < segmentCount; segment += 1) {
          const x = Math.floor(random() * canvas.width);
          const width = Math.max(
            1,
            Math.floor(random() * canvas.width * 0.22),
          );
          context.fillStyle = random() > 0.45
            ? colours.bone
            : colours.chromaRed;
          context.fillRect(x, y, Math.min(width, canvas.width - x), 1);
        }
      }
    };

    const renderTimecode = (intensity: number) => {
      const timecode = timecodeRef.current;
      if (timecode === null) {
        output.textContent = "";
        output.dataset.active = "false";
        return;
      }

      let displayed = timecode;
      if (intensity >= 0.6 && timecode.length > 0 && random() < 0.12) {
        const offset = Math.floor(random() * timecode.length);
        const corrupt = random() > 0.5 ? "#" : "?";
        displayed =
          timecode.slice(0, offset) + corrupt + timecode.slice(offset + 1);
      }
      output.textContent = displayed;
      output.dataset.active = "true";
    };

    const triggerHardRoll = () => {
      if (timersRef.current.roll !== null) return;
      stage.dataset.roll = "true";
      timersRef.current.roll = window.setTimeout(() => {
        delete stage.dataset.roll;
        timersRef.current.roll = null;
      }, motion.eventMs.trackingRoll);
    };

    const render = (timestamp: number) => {
      animationFrame = window.requestAnimationFrame(render);
      if (!visible || !isVHSFrameDue(timestamp, lastRenderedAt)) return;
      lastRenderedAt = timestamp;
      renderedFrames += 1;

      const intensity = intensityRef.current;
      const geometry = sampleVHSFrameGeometry(intensity, false, random);
      context.clearRect(0, 0, canvas.width, canvas.height);

      context.globalAlpha = 0.28 + intensity * 0.28;
      context.drawImage(scanlines, 0, 0);

      if (
        grainImage === null ||
        renderedFrames % effects.vhs.grainCycleFrames === 1
      ) {
        regenerateGrain();
      }
      context.globalAlpha = 0.42 + intensity * 0.22;
      context.drawImage(grain, 0, 0);

      drawDropouts(intensity, geometry.dropoutHeightPx);
      drawTornBottom(intensity, geometry.tearHeightPx);
      context.globalAlpha = 1;

      const jitter =
        random() < effects.vhs.jitterChance * Math.max(0.2, intensity)
          ? geometry.jitterYPx
          : 0;
      const wholePixelJitter = Math.round(jitter);
      if (wholePixelJitter !== lastJitter) {
        stage.style.setProperty("--vhs-jitter-y", wholePixelJitter + "px");
        lastJitter = wholePixelJitter;
      }

      if (
        random() <
        effects.vhs.hardRollChance * Math.max(0.25, intensity)
      ) {
        triggerHardRoll();
      }
      renderTimecode(intensity);
    };

    const handleResize = () => {
      buildStaticLayers();
      renderedFrames = 0;
      lastRenderedAt = null;
    };
    const handleVisibility = () => {
      visible = document.visibilityState !== "hidden";
      lastRenderedAt = null;
    };

    buildStaticLayers();
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibility);
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      stage.style.setProperty("--vhs-jitter-y", "0px");
      delete stage.dataset.roll;
      if (timersRef.current.roll !== null) {
        window.clearTimeout(timersRef.current.roll);
        timersRef.current.roll = null;
      }
    };
  }, [disabled]);

  return (
    <VHSContext.Provider value={controls}>
      <div
        ref={stageRef}
        className="vhs-stage"
        data-vhs-disabled={String(disabled)}
      >
        {children}
      </div>
      {!disabled && (
        <>
          <canvas
            ref={canvasRef}
            className="vhs-overlay"
            aria-hidden="true"
          />
          <svg
            className="vhs-filter-defs"
            width="0"
            height="0"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <filter id={DAMAGE_FILTER_ID} x="-4%" y="-4%" width="108%" height="108%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.012 0.7"
                  numOctaves={1}
                  seed={13}
                  result="damageNoise"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="damageNoise"
                  scale={9}
                  xChannelSelector="R"
                  yChannelSelector="B"
                />
              </filter>
            </defs>
          </svg>
        </>
      )}
      <output
        ref={timecodeElementRef}
        className="vhs-timecode"
        data-active="false"
        aria-hidden="true"
      />
    </VHSContext.Provider>
  );
}
