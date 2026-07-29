import {
  hasRoomArAcquisitionTimedOut,
  ROOM_AR_SCENE,
} from "./config";
import type {
  RoomArEvent,
  RoomArPlacement,
  RoomArState,
} from "./types";

function isFiniteTimestamp(atMs: number): boolean {
  return Number.isFinite(atMs);
}

function freezeRoomState(state: RoomArState): RoomArState {
  return Object.freeze(state);
}

function copyPlacement(
  placement: RoomArPlacement,
): RoomArPlacement | null {
  if (
    !Number.isFinite(placement.xMeters)
    || !Number.isFinite(placement.yMeters)
    || !Number.isFinite(placement.zMeters)
    || !Number.isFinite(placement.yawRadians)
  ) {
    return null;
  }

  return Object.freeze({
    xMeters: placement.xMeters,
    yMeters: placement.yMeters,
    zMeters: placement.zMeters,
    yawRadians: placement.yawRadians,
  });
}

export function createRoomArState(): RoomArState {
  return freezeRoomState({
    mechanism: "room",
    scene: ROOM_AR_SCENE,
    phase: "idle",
    initializedAtMs: null,
    candidatePlacement: null,
    placement: null,
    placementMode: null,
    placedAtMs: null,
    shotFiredAtMs: null,
    hitAtMs: null,
    collapseStartedAtMs: null,
    completedAtMs: null,
    fallbackReason: null,
    cancellationReason: null,
  });
}

/** Pure reducer for the pin 18 room-placement and combat mechanism only. */
export function roomArReducer(
  state: RoomArState,
  event: RoomArEvent,
): RoomArState {
  if (event.type === "cleanup") {
    if (state.phase === "cleanedUp") return state;
    return freezeRoomState({
      ...state,
      phase: "cleanedUp",
      candidatePlacement: null,
    });
  }

  if (event.type === "cancel") {
    if (
      state.phase === "cancelled"
      || state.phase === "cleanedUp"
      || state.phase === "completed"
    ) {
      return state;
    }
    return freezeRoomState({
      ...state,
      phase: "cancelled",
      candidatePlacement: null,
      cancellationReason: event.reason ?? null,
    });
  }

  switch (event.type) {
    case "initialize":
      if (state.phase !== "idle" || !isFiniteTimestamp(event.atMs)) {
        return state;
      }
      return freezeRoomState({
        ...state,
        phase: "initializing",
        initializedAtMs: event.atMs,
      });

    case "tracking":
      if (state.phase !== "initializing") return state;
      return freezeRoomState({ ...state, phase: "tracking" });

    case "acquired": {
      if (
        state.phase !== "initializing"
        && state.phase !== "tracking"
        && state.phase !== "acquired"
      ) {
        return state;
      }

      const candidatePlacement = copyPlacement(event.placement);
      if (candidatePlacement === null) return state;
      return freezeRoomState({
        ...state,
        phase: "acquired",
        candidatePlacement,
      });
    }

    case "lost":
      if (state.phase !== "acquired") return state;
      return freezeRoomState({
        ...state,
        phase: "tracking",
        candidatePlacement: null,
      });

    case "tick":
      if (
        (state.phase !== "initializing" && state.phase !== "tracking")
        || !hasRoomArAcquisitionTimedOut(state.initializedAtMs, event.atMs)
      ) {
        return state;
      }
      return freezeRoomState({
        ...state,
        phase: "fallback2d",
        candidatePlacement: null,
        fallbackReason: "acquisition-timeout",
      });

    case "fallback":
      if (
        state.phase !== "initializing"
        && state.phase !== "tracking"
        && state.phase !== "acquired"
      ) {
        return state;
      }
      return freezeRoomState({
        ...state,
        phase: "fallback2d",
        candidatePlacement: null,
        fallbackReason: event.reason ?? "unavailable",
      });

    case "tap-place": {
      if (!isFiniteTimestamp(event.atMs)) return state;

      if (state.phase === "fallback2d") {
        return freezeRoomState({
          ...state,
          phase: "placed",
          placementMode: "fallback2d",
          placedAtMs: event.atMs,
        });
      }

      if (state.phase !== "acquired" || state.candidatePlacement === null) {
        return state;
      }

      const placement = copyPlacement(state.candidatePlacement);
      if (placement === null) return state;
      return freezeRoomState({
        ...state,
        phase: "placed",
        candidatePlacement: null,
        placement,
        placementMode: "world",
        placedAtMs: event.atMs,
      });
    }

    case "fire":
      if (state.phase !== "placed" || !isFiniteTimestamp(event.atMs)) {
        return state;
      }
      return freezeRoomState({
        ...state,
        phase: "firing",
        shotFiredAtMs: event.atMs,
      });

    case "hit":
      if (state.phase !== "firing" || !isFiniteTimestamp(event.atMs)) {
        return state;
      }
      return freezeRoomState({
        ...state,
        phase: "hit",
        hitAtMs: event.atMs,
      });

    case "collapse":
      if (state.phase !== "hit" || !isFiniteTimestamp(event.atMs)) {
        return state;
      }
      return freezeRoomState({
        ...state,
        phase: "collapsing",
        collapseStartedAtMs: event.atMs,
      });

    case "complete":
      if (state.phase !== "collapsing" || !isFiniteTimestamp(event.atMs)) {
        return state;
      }
      return freezeRoomState({
        ...state,
        phase: "completed",
        completedAtMs: event.atMs,
      });

    default:
      return state;
  }
}

/** One-shot edge selectors for React effects and callback adapters. */
export function didRoomArShotFire(
  previous: RoomArState,
  next: RoomArState,
): boolean {
  return previous.shotFiredAtMs === null && next.shotFiredAtMs !== null;
}

export function didRoomArComplete(
  previous: RoomArState,
  next: RoomArState,
): boolean {
  return previous.completedAtMs === null && next.completedAtMs !== null;
}
