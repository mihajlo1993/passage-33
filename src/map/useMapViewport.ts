import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, PointerEventHandler, RefObject } from "react";
import {
  INITIAL_MAP_VIEWPORT,
  MAP_DOUBLE_TAP_ZOOM_SCALE,
  boundMapViewport,
  distanceBetweenMapViewportPoints,
  fitMapViewportScale,
  initialMapViewport,
  isMapTapGesture,
  isMapViewportFrameDue,
  mapViewportTransformsEqual,
  midpointMapViewport,
  panMapViewport,
  pinchMapViewport,
  registerMapTap,
  zoomMapViewportAt,
} from "./viewport";
import type {
  MapTap,
  MapViewportPoint,
  MapViewportSize,
  MapViewportTransform,
} from "./viewport";

export interface MapViewportHandlers {
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: PointerEventHandler<HTMLDivElement>;
  onLostPointerCapture: PointerEventHandler<HTMLDivElement>;
}

export interface MapViewportController {
  handlers: MapViewportHandlers;
  style: CSSProperties;
  state: MapViewportTransform;
  frameRef: RefObject<HTMLDivElement | null>;
  reset: () => void;
  /** Multiply the scale, anchored at the viewport centre. Buttons use this. */
  zoomBy: (factor: number) => void;
}

interface MeasuredPointer {
  point: MapViewportPoint;
  size: MapViewportSize;
}

interface PanGesture {
  kind: "pan";
  pointerId: number;
  startPoint: MapViewportPoint;
  startTransform: MapViewportTransform;
}

interface PinchGesture {
  kind: "pinch";
  pointerIds: readonly [number, number];
  startCentroid: MapViewportPoint;
  startDistance: number;
  startTransform: MapViewportTransform;
}

type Gesture = PanGesture | PinchGesture;

interface TapCandidate {
  pointerId: number;
  startedAtMs: number;
  startPoint: MapViewportPoint;
  maximumTravelPx: number;
}

function measurePointer(
  event: ReactPointerEvent<HTMLDivElement>,
): MeasuredPointer {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    point: {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    },
    size: {
      width: rect.width,
      height: rect.height,
    },
  };
}

function copyInitialTransform(): MapViewportTransform {
  return { ...INITIAL_MAP_VIEWPORT };
}

export function useMapViewport(): MapViewportController {
  const [state, setState] = useState<MapViewportTransform>(copyInitialTransform);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef<MapViewportSize | null>(null);
  const desiredTransformRef = useRef<MapViewportTransform>(copyInitialTransform());
  const renderedTransformRef = useRef<MapViewportTransform>(copyInitialTransform());
  const pointersRef = useRef(new Map<number, MapViewportPoint>());
  const capturesRef = useRef(new Map<number, HTMLDivElement>());
  const gestureRef = useRef<Gesture | null>(null);
  const tapCandidateRef = useRef<TapCandidate | null>(null);
  const lastTapRef = useRef<MapTap | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const mountedRef = useRef(true);

  const flushFrame = useCallback(function flushMapViewportFrame(timestampMs: number) {
    rafRef.current = null;
    if (!mountedRef.current || !dirtyRef.current) {
      return;
    }

    if (!isMapViewportFrameDue(timestampMs, lastFrameAtRef.current)) {
      rafRef.current = requestAnimationFrame(flushMapViewportFrame);
      return;
    }

    const next = desiredTransformRef.current;
    dirtyRef.current = false;
    lastFrameAtRef.current = timestampMs;
    renderedTransformRef.current = next;
    setState(next);
  }, []);

  const queueTransform = useCallback((next: MapViewportTransform) => {
    desiredTransformRef.current = next;

    if (mapViewportTransformsEqual(next, renderedTransformRef.current)) {
      dirtyRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    dirtyRef.current = true;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushFrame);
    }
  }, [flushFrame]);

  const applyTransformImmediately = useCallback((next: MapViewportTransform) => {
    desiredTransformRef.current = next;
    renderedTransformRef.current = next;
    dirtyRef.current = false;
    if (mountedRef.current) {
      setState(next);
    }
  }, []);

  const reset = useCallback(() => {
    const size = sizeRef.current;
    queueTransform(size ? initialMapViewport(size) : copyInitialTransform());
  }, [queueTransform]);

  const zoomBy = useCallback((factor: number) => {
    const frame = frameRef.current;
    const rect = frame?.getBoundingClientRect();
    const size = rect && rect.width > 0
      ? { width: rect.width, height: rect.height }
      : sizeRef.current;
    if (!size) return;
    sizeRef.current = size;
    const current = desiredTransformRef.current;
    queueTransform(zoomMapViewportAt(
      current,
      current.scale * factor,
      { x: size.width / 2, y: size.height / 2 },
      size,
    ));
  }, [queueTransform]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const measure = () => {
      const rect = frame.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return;
      }
      const size = { width: rect.width, height: rect.height };
      const previous = sizeRef.current;
      sizeRef.current = size;
      if (previous === null) {
        // First measure before paint: open on the whole flat.
        applyTransformImmediately(initialMapViewport(size));
        return;
      }
      if (previous.width !== size.width || previous.height !== size.height) {
        // URL bar collapse or rotation mid-session: re-clamp, never jump.
        queueTransform(boundMapViewport(desiredTransformRef.current, size));
      }
    };

    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [applyTransformImmediately, queueTransform]);

  const beginGesture = useCallback(() => {
    const pointers = [...pointersRef.current.entries()];
    if (pointers.length === 0) {
      gestureRef.current = null;
      return;
    }

    if (pointers.length === 1) {
      gestureRef.current = {
        kind: "pan",
        pointerId: pointers[0][0],
        startPoint: pointers[0][1],
        startTransform: desiredTransformRef.current,
      };
      return;
    }

    const first = pointers[0];
    const second = pointers[1];
    gestureRef.current = {
      kind: "pinch",
      pointerIds: [first[0], second[0]],
      startCentroid: midpointMapViewport(first[1], second[1]),
      startDistance: distanceBetweenMapViewportPoints(first[1], second[1]),
      startTransform: desiredTransformRef.current,
    };
  }, []);

  const onPointerDown = useCallback<PointerEventHandler<HTMLDivElement>>((event) => {
    const measured = measurePointer(event);
    sizeRef.current = measured.size;
    pointersRef.current.set(event.pointerId, measured.point);
    capturesRef.current.set(event.pointerId, event.currentTarget);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A cancelled pointer can disappear before capture is established.
    }

    if (pointersRef.current.size === 1) {
      tapCandidateRef.current = {
        pointerId: event.pointerId,
        startedAtMs: event.timeStamp,
        startPoint: measured.point,
        maximumTravelPx: 0,
      };
    } else {
      tapCandidateRef.current = null;
      lastTapRef.current = null;
    }
    beginGesture();
  }, [beginGesture]);

  const onPointerMove = useCallback<PointerEventHandler<HTMLDivElement>>((event) => {
    if (!pointersRef.current.has(event.pointerId)) {
      return;
    }

    const measured = measurePointer(event);
    sizeRef.current = measured.size;
    pointersRef.current.set(event.pointerId, measured.point);
    const tapCandidate = tapCandidateRef.current;
    if (tapCandidate?.pointerId === event.pointerId) {
      tapCandidate.maximumTravelPx = Math.max(
        tapCandidate.maximumTravelPx,
        distanceBetweenMapViewportPoints(tapCandidate.startPoint, measured.point),
      );
    }

    const gesture = gestureRef.current;
    if (gesture?.kind === "pan" && gesture.pointerId === event.pointerId) {
      queueTransform(panMapViewport(
        gesture.startTransform,
        {
          x: measured.point.x - gesture.startPoint.x,
          y: measured.point.y - gesture.startPoint.y,
        },
        measured.size,
      ));
      return;
    }

    if (gesture?.kind === "pinch") {
      const first = pointersRef.current.get(gesture.pointerIds[0]);
      const second = pointersRef.current.get(gesture.pointerIds[1]);
      if (first && second) {
        queueTransform(pinchMapViewport(
          gesture.startTransform,
          gesture.startCentroid,
          midpointMapViewport(first, second),
          gesture.startDistance,
          distanceBetweenMapViewportPoints(first, second),
          measured.size,
        ));
      }
    }
  }, [queueTransform]);

  const finishPointer = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    cancelled: boolean,
    captureAlreadyLost: boolean,
  ) => {
    if (!pointersRef.current.has(event.pointerId)) {
      return;
    }

    const measured = measurePointer(event);
    const tapCandidate = tapCandidateRef.current;
    let completedTap: MapTap | null = null;
    if (!cancelled
      && pointersRef.current.size === 1
      && tapCandidate?.pointerId === event.pointerId) {
      const maximumTravelPx = Math.max(
        tapCandidate.maximumTravelPx,
        distanceBetweenMapViewportPoints(tapCandidate.startPoint, measured.point),
      );
      if (isMapTapGesture(tapCandidate.startedAtMs, event.timeStamp, maximumTravelPx)) {
        completedTap = { point: measured.point, atMs: event.timeStamp };
      }
    }

    pointersRef.current.delete(event.pointerId);
    const captureTarget = capturesRef.current.get(event.pointerId);
    capturesRef.current.delete(event.pointerId);
    if (!captureAlreadyLost && captureTarget) {
      try {
        if (captureTarget.hasPointerCapture(event.pointerId)) {
          captureTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Capture may have been released by the user agent first.
      }
    }

    tapCandidateRef.current = null;
    if (cancelled) {
      lastTapRef.current = null;
    }
    beginGesture();

    if (completedTap) {
      const registration = registerMapTap(lastTapRef.current, completedTap);
      lastTapRef.current = registration.nextTap;
      if (registration.isDoubleTap) {
        const size = sizeRef.current ?? measured.size;
        const current = desiredTransformRef.current;
        const fit = fitMapViewportScale(size);
        if (current.scale > fit * 1.05) {
          // Zoomed in: double-tap returns to the whole flat.
          queueTransform(initialMapViewport(size));
        } else {
          // At fit: double-tap dives into the tapped spot.
          queueTransform(zoomMapViewportAt(
            current,
            MAP_DOUBLE_TAP_ZOOM_SCALE,
            completedTap.point,
            size,
          ));
        }
      }
    }
  }, [beginGesture, queueTransform]);

  const onPointerUp = useCallback<PointerEventHandler<HTMLDivElement>>((event) => {
    onPointerMove(event);
    finishPointer(event, false, false);
  }, [finishPointer, onPointerMove]);

  const onPointerCancel = useCallback<PointerEventHandler<HTMLDivElement>>((event) => {
    finishPointer(event, true, false);
  }, [finishPointer]);

  const onLostPointerCapture = useCallback<PointerEventHandler<HTMLDivElement>>((event) => {
    finishPointer(event, true, true);
  }, [finishPointer]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      dirtyRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      for (const [pointerId, target] of capturesRef.current) {
        try {
          if (target.hasPointerCapture(pointerId)) {
            target.releasePointerCapture(pointerId);
          }
        } catch {
          // The target can detach before React runs effect cleanup.
        }
      }
      capturesRef.current.clear();
      pointersRef.current.clear();
      gestureRef.current = null;
      tapCandidateRef.current = null;
      lastTapRef.current = null;
      lastFrameAtRef.current = null;
    };
  }, []);

  const handlers = useMemo<MapViewportHandlers>(() => ({
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
  }), [
    onLostPointerCapture,
    onPointerCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  ]);

  const style = useMemo<CSSProperties>(() => ({
    transform: `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`,
    transformOrigin: "0 0",
  }), [state]);

  return { handlers, style, state, frameRef, reset, zoomBy };
}
