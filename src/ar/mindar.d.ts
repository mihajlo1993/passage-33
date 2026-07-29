declare module "mind-ar/dist/mindar-image.prod.js" {
  export type MindArControllerUpdate =
    | {
        readonly type: "updateMatrix";
        readonly targetIndex: number;
        readonly worldMatrix: number[] | null;
      }
    | { readonly type: "processDone" };

  export interface MindArControllerOptions {
    readonly inputWidth: number;
    readonly inputHeight: number;
    readonly onUpdate?: ((update: MindArControllerUpdate) => void) | null;
    readonly debugMode?: boolean;
    readonly maxTrack?: number;
    readonly warmupTolerance?: number | null;
    readonly missTolerance?: number | null;
    readonly filterMinCF?: number | null;
    readonly filterBeta?: number | null;
  }

  export interface MindArImageTargets {
    readonly dimensions: Array<[number, number]>;
    readonly matchingDataList: unknown[];
    readonly trackingDataList: unknown[];
  }

  export type MindArModelViewTransform = number[][];

  export interface MindArInputTensor {
    dispose(): void;
  }

  export interface MindArInputLoader {
    loadInput(input: HTMLVideoElement): MindArInputTensor;
  }

  export interface MindArTrackingFilter {
    reset(): void;
    filter(timestampMs: number, values: number[]): number[];
  }

  export interface MindArTrackingState {
    showing: boolean;
    isTracking: boolean;
    currentModelViewTransform: MindArModelViewTransform | null;
    trackCount: number;
    trackMiss: number;
    trackingMatrix: number[] | null;
    filter: MindArTrackingFilter;
  }

  export class Controller {
    inputWidth: number;
    inputHeight: number;
    maxTrack: number;
    warmupTolerance: number;
    missTolerance: number;
    filterMinCF: number;
    filterBeta: number;
    interestedTargetIndex: number;
    onUpdate: ((update: MindArControllerUpdate) => void) | null;
    processingVideo: boolean;
    markerDimensions: Array<[number, number]> | null;
    inputLoader: MindArInputLoader;
    trackingStates: MindArTrackingState[];

    constructor(options: MindArControllerOptions);

    addImageTargetsFromBuffer(
      buffer: ArrayBuffer | Uint8Array,
    ): MindArImageTargets;
    dummyRun(input: HTMLVideoElement): void;
    stopProcessVideo(): void;
    getProjectionMatrix(): number[];
    getRotatedZ90Matrix(matrix: number[]): number[];
    _detectAndMatch(
      input: MindArInputTensor,
      targetIndexes: number[],
    ): Promise<{
      targetIndex: number;
      modelViewTransform: MindArModelViewTransform;
    }>;
    _trackAndUpdate(
      input: MindArInputTensor,
      lastModelViewTransform: MindArModelViewTransform,
      targetIndex: number,
    ): Promise<MindArModelViewTransform | null>;
    _glModelViewMatrix(
      modelViewTransform: MindArModelViewTransform,
      targetIndex: number,
    ): number[];
    dispose(): void;
  }
}
