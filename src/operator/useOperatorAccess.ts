"use client";

import { useCallback, useEffect, useState } from "react";

import {
  IDLE_OPERATOR_GESTURE,
  OPERATOR_CORNER_SIZE_PX,
  nextOperatorGestureDeadline,
  OPERATOR_SEQUENCE_WINDOW_MS,
  stepOperatorGesture,
  type OperatorGestureEvent,
  type OperatorGestureState,
} from "./gesture";

export interface OperatorAccessController {
  readonly open: boolean;
  readonly close: () => void;
}

function isCornerClick(event: MouseEvent): boolean {
  return (
    event.clientY >= 0
    && event.clientY <= OPERATOR_CORNER_SIZE_PX
    && (
      event.clientX <= OPERATOR_CORNER_SIZE_PX
      || event.clientX >= window.innerWidth - OPERATOR_CORNER_SIZE_PX
    )
  );
}

/**
 * Installs only global pointer listeners. No trigger, hit area, label, data
 * attribute, or other discoverable element exists before access succeeds.
 */
export function useOperatorAccess(): OperatorAccessController {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) return;

    let gesture: OperatorGestureState = IDLE_OPERATOR_GESTURE;
    let timer: number | null = null;
    let suppressCornerClickUntilMs = 0;

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = () => {
      clearTimer();
      const deadline = nextOperatorGestureDeadline(gesture);
      if (deadline === null) return;
      timer = window.setTimeout(() => {
        timer = null;
        process({ type: "tick", atMs: Date.now() });
      }, Math.max(0, deadline - Date.now()));
    };

    const process = (event: OperatorGestureEvent): boolean => {
      const step = stepOperatorGesture(
        gesture,
        event,
        { width: window.innerWidth },
      );
      gesture = step.state;

      if (step.armed) {
        suppressCornerClickUntilMs = nextOperatorGestureDeadline(gesture)
          ?? Date.now();
      }
      if (step.activated) {
        suppressCornerClickUntilMs = Date.now() + OPERATOR_SEQUENCE_WINDOW_MS;
        setOpen(true);
      }
      schedule();
      return step.consume;
    };

    const sendPointer = (
      event: PointerEvent,
      type: "pointer-down" | "pointer-move" | "pointer-up",
    ) => {
      const consumed = process({
        type,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        atMs: Date.now(),
      });
      if (consumed) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      sendPointer(event, "pointer-down");
    };
    const handlePointerMove = (event: PointerEvent) => {
      sendPointer(event, "pointer-move");
    };
    const handlePointerUp = (event: PointerEvent) => {
      sendPointer(event, "pointer-up");
    };
    const handlePointerCancel = (event: PointerEvent) => {
      const consumed = process({
        type: "pointer-cancel",
        pointerId: event.pointerId,
        atMs: Date.now(),
      });
      if (consumed) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const handleClick = (event: MouseEvent) => {
      if (
        Date.now() <= suppressCornerClickUntilMs
        && isCornerClick(event)
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const handleContextMenu = (event: MouseEvent) => {
      if (gesture.stage === "left-held" && isCornerClick(event)) {
        event.preventDefault();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("pointercancel", handlePointerCancel, true);
    window.addEventListener("click", handleClick, true);
    window.addEventListener("contextmenu", handleContextMenu, true);

    return () => {
      clearTimer();
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerCancel, true);
      window.removeEventListener("click", handleClick, true);
      window.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, [open]);

  return { open, close };
}
