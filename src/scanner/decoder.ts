import jsQR from "jsqr";

export type QrDecoderKind = "barcode-detector" | "jsqr";

export interface QrDecoder {
  readonly kind: QrDecoderKind;
  decode: (video: HTMLVideoElement) => Promise<string[]>;
}

interface DetectedBarcodeLike {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcodeLike[]>;
}

interface BarcodeDetectorConstructorLike {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

interface WindowWithBarcodeDetector extends Window {
  BarcodeDetector?: BarcodeDetectorConstructorLike;
}

function barcodeDetectorConstructor(): BarcodeDetectorConstructorLike | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (window as WindowWithBarcodeDetector).BarcodeDetector ?? null;
}

class NativeQrDecoder implements QrDecoder {
  readonly kind = "barcode-detector" as const;

  constructor(private readonly detector: BarcodeDetectorLike) {}

  async decode(video: HTMLVideoElement): Promise<string[]> {
    const results = await this.detector.detect(video);
    return results
      .map(({ rawValue }) => rawValue)
      .filter((value): value is string => typeof value === "string");
  }
}

class JsQrDecoder implements QrDecoder {
  readonly kind = "jsqr" as const;
  private readonly canvas = document.createElement("canvas");
  private readonly context = this.canvas.getContext("2d", {
    alpha: false,
    willReadFrequently: true,
  });

  async decode(video: HTMLVideoElement): Promise<string[]> {
    if (!this.context || video.videoWidth === 0 || video.videoHeight === 0) {
      return [];
    }

    // A bounded frame keeps the CPU fallback responsive on the target phone.
    const maxEdge = 960;
    const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    this.context.drawImage(video, 0, 0, width, height);
    const frame = this.context.getImageData(0, 0, width, height);
    const result = jsQR(frame.data, width, height, {
      inversionAttempts: "attemptBoth",
    });

    return result?.data ? [result.data] : [];
  }
}

async function createNativeDecoder(): Promise<QrDecoder | null> {
  const Detector = barcodeDetectorConstructor();
  if (!Detector) {
    return null;
  }

  try {
    if (Detector.getSupportedFormats) {
      const formats = await Detector.getSupportedFormats();
      if (!formats.includes("qr_code")) {
        return null;
      }
    }
    return new NativeQrDecoder(new Detector({ formats: ["qr_code"] }));
  } catch {
    return null;
  }
}

/** Prefers Chrome's native detector and falls back to the bundled jsQR decoder. */
export async function createQrDecoder(): Promise<QrDecoder> {
  return (await createNativeDecoder()) ?? new JsQrDecoder();
}

/** Used if a device exposes BarcodeDetector but fails while decoding a frame. */
export function createJsQrDecoder(): QrDecoder {
  return new JsQrDecoder();
}
