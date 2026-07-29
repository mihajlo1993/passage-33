import { layout, motion } from "../tokens";

export const OPERATOR_CORNER_SIZE_PX = layout.controlHeightPx;
export const OPERATOR_LONG_PRESS_MS = motion.eventMs.operatorLongPress;
export const OPERATOR_SEQUENCE_WINDOW_MS = motion.eventMs.operatorSequenceWindow;

export interface OperatorGestureViewport {
  readonly width: number;
}

export type OperatorGestureState =
  | { readonly stage: "idle" }
  | {
      readonly stage: "left-held";
      readonly pointerId: number;
      readonly startedAtMs: number;
    }
  | {
      readonly stage: "right-ready";
      readonly expiresAtMs: number;
      readonly taps: 0 | 1;
    }
  | {
      readonly stage: "right-held";
      readonly pointerId: number;
      readonly expiresAtMs: number;
      readonly taps: 0 | 1;
    };

export type OperatorGestureEvent =
  | {
      readonly type: "pointer-down" | "pointer-move" | "pointer-up";
      readonly pointerId: number;
      readonly x: number;
      readonly y: number;
      readonly atMs: number;
    }
  | {
      readonly type: "pointer-cancel";
      readonly pointerId: number;
      readonly atMs: number;
    }
  | { readonly type: "tick"; readonly atMs: number };

export interface OperatorGestureStep {
  readonly state: OperatorGestureState;
  readonly activated: boolean;
  readonly armed: boolean;
  readonly consume: boolean;
}

export const IDLE_OPERATOR_GESTURE: OperatorGestureState = Object.freeze({
  stage: "idle",
});

function pointIsTopLeft(
  x: number,
  y: number,
  viewport: OperatorGestureViewport,
): boolean {
  return (
    viewport.width > 0
    && x >= 0
    && y >= 0
    && x <= OPERATOR_CORNER_SIZE_PX
    && y <= OPERATOR_CORNER_SIZE_PX
  );
}

function pointIsTopRight(
  x: number,
  y: number,
  viewport: OperatorGestureViewport,
): boolean {
  return (
    viewport.width > 0
    && x >= viewport.width - OPERATOR_CORNER_SIZE_PX
    && x <= viewport.width
    && y >= 0
    && y <= OPERATOR_CORNER_SIZE_PX
  );
}

function advanceForTime(
  state: OperatorGestureState,
  atMs: number,
): { state: OperatorGestureState; armed: boolean } {
  if (state.stage === "left-held") {
    const armedAtMs = state.startedAtMs + OPERATOR_LONG_PRESS_MS;
    if (atMs >= armedAtMs) {
      const expiresAtMs = armedAtMs + OPERATOR_SEQUENCE_WINDOW_MS;
      if (atMs > expiresAtMs) {
        return { state: IDLE_OPERATOR_GESTURE, armed: false };
      }
      return {
        state: { stage: "right-ready", expiresAtMs, taps: 0 },
        armed: true,
      };
    }
  }

  if (
    (state.stage === "right-ready" || state.stage === "right-held")
    && atMs > state.expiresAtMs
  ) {
    return { state: IDLE_OPERATOR_GESTURE, armed: false };
  }

  return { state, armed: false };
}

/**
 * Pure recognizer for the production access sequence. It intentionally owns no
 * element: before activation the React adapter installs capture listeners and
 * renders nothing at all.
 */
export function stepOperatorGesture(
  current: OperatorGestureState,
  event: OperatorGestureEvent,
  viewport: OperatorGestureViewport,
): OperatorGestureStep {
  const advanced = advanceForTime(current, event.atMs);
  let state = advanced.state;
  let activated = false;
  let consume = false;

  switch (event.type) {
    case "pointer-down":
      if (state.stage === "idle" && pointIsTopLeft(event.x, event.y, viewport)) {
        state = {
          stage: "left-held",
          pointerId: event.pointerId,
          startedAtMs: event.atMs,
        };
      } else if (
        state.stage === "right-ready"
        && pointIsTopRight(event.x, event.y, viewport)
      ) {
        state = {
          stage: "right-held",
          pointerId: event.pointerId,
          expiresAtMs: state.expiresAtMs,
          taps: state.taps,
        };
        consume = true;
      }
      break;

    case "pointer-move":
      if (
        state.stage === "left-held"
        && state.pointerId === event.pointerId
        && !pointIsTopLeft(event.x, event.y, viewport)
      ) {
        state = IDLE_OPERATOR_GESTURE;
      } else if (
        state.stage === "right-held"
        && state.pointerId === event.pointerId
        && !pointIsTopRight(event.x, event.y, viewport)
      ) {
        state = {
          stage: "right-ready",
          expiresAtMs: state.expiresAtMs,
          taps: state.taps,
        };
        consume = true;
      }
      break;

    case "pointer-up":
      if (state.stage === "left-held" && state.pointerId === event.pointerId) {
        state = IDLE_OPERATOR_GESTURE;
      } else if (
        state.stage === "right-held"
        && state.pointerId === event.pointerId
      ) {
        consume = true;
        if (pointIsTopRight(event.x, event.y, viewport)) {
          if (state.taps === 1) {
            state = IDLE_OPERATOR_GESTURE;
            activated = true;
          } else {
            state = {
              stage: "right-ready",
              expiresAtMs: state.expiresAtMs,
              taps: 1,
            };
          }
        } else {
          state = {
            stage: "right-ready",
            expiresAtMs: state.expiresAtMs,
            taps: state.taps,
          };
        }
      }
      break;

    case "pointer-cancel":
      if (
        (state.stage === "left-held" || state.stage === "right-held")
        && state.pointerId === event.pointerId
      ) {
        state = state.stage === "right-held"
          ? {
              stage: "right-ready",
              expiresAtMs: state.expiresAtMs,
              taps: state.taps,
            }
          : IDLE_OPERATOR_GESTURE;
      }
      break;

    case "tick":
      break;
  }

  return {
    state,
    activated,
    armed: advanced.armed,
    consume,
  };
}

export function nextOperatorGestureDeadline(
  state: OperatorGestureState,
): number | null {
  if (state.stage === "left-held") {
    return state.startedAtMs + OPERATOR_LONG_PRESS_MS;
  }
  if (state.stage === "right-ready" || state.stage === "right-held") {
    // The exact endpoint remains valid; expire on the first millisecond after.
    return state.expiresAtMs + 1;
  }
  return null;
}
