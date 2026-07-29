import { isArFrameDue } from "./config";

import type {
  Controller,
  MindArInputTensor,
  MindArModelViewTransform,
  MindArTrackingFilter,
  MindArTrackingState,
} from "mind-ar/dist/mindar-image.prod.js";

export interface MindArFrameHost {
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(handle: number): void;
}

export interface CappedMindArProcessingOptions {
  readonly controller: Controller;
  readonly input: HTMLVideoElement;
  readonly onError?: (error: unknown) => void;
  /** Injectable only so the scheduling contract can be tested without a DOM. */
  readonly frameHost?: MindArFrameHost;
}

export interface CappedMindArProcessing {
  readonly running: boolean;
  stop(): void;
}

function smoothingFactor(elapsedMs: number, cutoff: number): number {
  const rate = 2 * Math.PI * cutoff * elapsedMs;
  return rate / (rate + 1);
}

function exponentialSmoothing(
  amount: number,
  value: number,
  previous: number,
): number {
  return amount * value + (1 - amount) * previous;
}

/**
 * MindAR does not export its filter. This local equivalent deliberately tracks
 * the 1.2.5 implementation so replacing its self-paced loop does not change
 * target warmup, miss tolerance, or matrix smoothing.
 */
class MindArOneEuroFilter implements MindArTrackingFilter {
  private readonly derivativeCutoff = 0.001;
  private previousValues: number[] | null = null;
  private previousDerivatives: number[] | null = null;
  private previousTimestampMs: number | null = null;
  private initialized = false;

  constructor(
    private readonly minimumCutoff: number,
    private readonly beta: number,
  ) {}

  reset(): void {
    this.initialized = false;
  }

  filter(timestampMs: number, values: number[]): number[] {
    if (!this.initialized) {
      this.initialized = true;
      this.previousValues = values;
      this.previousDerivatives = values.map(() => 0);
      this.previousTimestampMs = timestampMs;
      return values;
    }

    const previousValues = this.previousValues as number[];
    const previousDerivatives = this.previousDerivatives as number[];
    const elapsedMs = timestampMs - (this.previousTimestampMs as number);
    const derivativeAmount = smoothingFactor(
      elapsedMs,
      this.derivativeCutoff,
    );
    const derivatives: number[] = [];
    const filteredDerivatives: number[] = [];
    const filteredValues: number[] = [];

    for (let index = 0; index < values.length; index += 1) {
      derivatives[index] = (values[index] - previousValues[index]) / elapsedMs;
      filteredDerivatives[index] = exponentialSmoothing(
        derivativeAmount,
        derivatives[index],
        previousDerivatives[index],
      );
      const cutoff = this.minimumCutoff
        + this.beta * Math.abs(filteredDerivatives[index]);
      filteredValues[index] = exponentialSmoothing(
        smoothingFactor(elapsedMs, cutoff),
        values[index],
        previousValues[index],
      );
    }

    this.previousValues = filteredValues;
    this.previousDerivatives = filteredDerivatives;
    this.previousTimestampMs = timestampMs;
    return filteredValues;
  }
}

function createTrackingState(controller: Controller): MindArTrackingState {
  return {
    showing: false,
    isTracking: false,
    currentModelViewTransform: null,
    trackCount: 0,
    trackMiss: 0,
    trackingMatrix: null,
    filter: new MindArOneEuroFilter(
      controller.filterMinCF,
      controller.filterBeta,
    ),
  };
}

function browserFrameHost(): MindArFrameHost {
  return {
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (handle) => window.cancelAnimationFrame(handle),
  };
}

/**
 * Runs MindAR's 1.2.5 image-controller state machine from an app-owned frame
 * scheduler. A new detector/tracker pass cannot start until both the configured
 * 30fps interval and the preceding asynchronous pass have completed.
 */
export function startCappedMindArProcessing(
  options: CappedMindArProcessingOptions,
): CappedMindArProcessing {
  const { controller, input, onError } = options;
  const frameHost = options.frameHost ?? browserFrameHost();
  const markerDimensions = controller.markerDimensions;

  if (controller.processingVideo) {
    throw new Error("MindAR video processing is already active.");
  }
  if (!markerDimensions || markerDimensions.length === 0) {
    throw new Error("MindAR target data must be loaded before processing.");
  }

  controller.trackingStates = markerDimensions.map(() =>
    createTrackingState(controller));
  controller.processingVideo = true;

  let active = true;
  let frameHandle: number | null = null;
  let lastFrameStartedAtMs: number | null = null;
  let failureNotified = false;

  function cancelScheduledFrame(): void {
    if (frameHandle === null) return;
    frameHost.cancelFrame(frameHandle);
    frameHandle = null;
  }

  function stop(): void {
    if (!active) return;
    active = false;
    cancelScheduledFrame();
    controller.processingVideo = false;
    try {
      controller.stopProcessVideo();
    } catch {
      // The app's loop is already stopped; disposal can continue safely.
    }
  }

  function fail(error: unknown): void {
    if (failureNotified || !active) return;
    failureNotified = true;
    stop();
    onError?.(error);
  }

  async function processFrame(): Promise<void> {
    let inputTensor: MindArInputTensor | null = null;
    try {
      if (!active) return;
      inputTensor = controller.inputLoader.loadInput(input);

      const activeTrackCount = controller.trackingStates.reduce(
        (count, state) => count + (state.isTracking ? 1 : 0),
        0,
      );

      if (activeTrackCount < controller.maxTrack) {
        const matchingIndexes: number[] = [];
        for (
          let index = 0;
          index < controller.trackingStates.length;
          index += 1
        ) {
          const state = controller.trackingStates[index];
          if (state.isTracking) continue;
          if (
            controller.interestedTargetIndex !== -1
            && controller.interestedTargetIndex !== index
          ) {
            continue;
          }
          matchingIndexes.push(index);
        }

        const match = await controller._detectAndMatch(
          inputTensor,
          matchingIndexes,
        );
        if (!active) return;
        if (match.targetIndex !== -1) {
          const matchedState = controller.trackingStates[match.targetIndex];
          if (!matchedState) {
            throw new Error("MindAR returned an unknown target index.");
          }
          matchedState.isTracking = true;
          matchedState.currentModelViewTransform = match.modelViewTransform;
        }
      }

      for (
        let index = 0;
        index < controller.trackingStates.length;
        index += 1
      ) {
        if (!active) return;
        const state = controller.trackingStates[index];

        if (state.isTracking) {
          const transform = await controller._trackAndUpdate(
            inputTensor,
            state.currentModelViewTransform as MindArModelViewTransform,
            index,
          );
          if (!active) return;
          if (transform === null) {
            state.isTracking = false;
          } else {
            state.currentModelViewTransform = transform;
          }
        }

        if (!state.showing && state.isTracking) {
          state.trackMiss = 0;
          state.trackCount += 1;
          if (state.trackCount > controller.warmupTolerance) {
            state.showing = true;
            state.trackingMatrix = null;
            state.filter.reset();
          }
        }

        if (state.showing) {
          if (state.isTracking) {
            state.trackMiss = 0;
          } else {
            state.trackCount = 0;
            state.trackMiss += 1;
            if (state.trackMiss > controller.missTolerance) {
              state.showing = false;
              state.trackingMatrix = null;
              controller.onUpdate?.({
                type: "updateMatrix",
                targetIndex: index,
                worldMatrix: null,
              });
            }
          }
        }

        if (state.showing) {
          const worldMatrix = controller._glModelViewMatrix(
            state.currentModelViewTransform as MindArModelViewTransform,
            index,
          );
          state.trackingMatrix = state.filter.filter(Date.now(), worldMatrix);
          let outputMatrix = [...state.trackingMatrix];
          if (
            input.width === controller.inputHeight
            && input.height === controller.inputWidth
          ) {
            outputMatrix = controller.getRotatedZ90Matrix(outputMatrix);
          }
          controller.onUpdate?.({
            type: "updateMatrix",
            targetIndex: index,
            worldMatrix: outputMatrix,
          });
        }
      }

      if (active) {
        controller.onUpdate?.({ type: "processDone" });
      }
    } finally {
      inputTensor?.dispose();
    }
  }

  function scheduleFrame(): void {
    if (!active || frameHandle !== null) return;
    frameHandle = frameHost.requestFrame(runScheduledFrame);
  }

  function runScheduledFrame(timestampMs: number): void {
    frameHandle = null;
    if (!active) return;
    if (!isArFrameDue(timestampMs, lastFrameStartedAtMs)) {
      scheduleFrame();
      return;
    }

    lastFrameStartedAtMs = timestampMs;
    void processFrame().then(
      () => scheduleFrame(),
      (error: unknown) => fail(error),
    );
  }

  try {
    scheduleFrame();
  } catch (error) {
    fail(error);
    throw error;
  }

  return {
    get running(): boolean {
      return active;
    },
    stop,
  };
}
