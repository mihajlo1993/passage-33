"use client";

import type { GameState } from "../types";
import { deriveSurveyMap, openingCenterline } from "./model";
import type {
  DoorGeometry,
  MapPoint,
  MapSegment,
  OpeningBounds,
  RoomStatusLabel,
} from "./types";

function pointList(points: readonly MapPoint[]): string {
  return points.map(({ x, y }) => `${x},${y}`).join(" ");
}

function segmentProps(segment: MapSegment) {
  return {
    x1: segment.start.x,
    y1: segment.start.y,
    x2: segment.end.x,
    y2: segment.end.y,
  };
}

function openingProps(opening: OpeningBounds) {
  return {
    x: opening.x,
    y: opening.y,
    width: opening.width,
    height: opening.height,
  };
}

function passageTickPath(opening: MapSegment): string {
  const dx = opening.end.x - opening.start.x;
  const dy = opening.end.y - opening.start.y;
  const length = Math.hypot(dx, dy) || 1;
  const offsetX = (-dy / length) * 4;
  const offsetY = (dx / length) * 4;
  const { start, end } = opening;

  return [
    `M ${start.x + offsetX} ${start.y + offsetY}`,
    `L ${start.x - offsetX} ${start.y - offsetY}`,
    `M ${end.x + offsetX} ${end.y + offsetY}`,
    `L ${end.x - offsetX} ${end.y - offsetY}`,
  ].join(" ");
}

function samePoint(left: MapPoint, right: MapPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

function doorPath(door: DoorGeometry): string {
  const freeThresholdEnd = samePoint(door.threshold.start, door.hinge)
    ? door.threshold.end
    : door.threshold.start;
  const radius = Math.hypot(
    door.openLeafEnd.x - door.hinge.x,
    door.openLeafEnd.y - door.hinge.y,
  );

  return [
    `M ${door.hinge.x} ${door.hinge.y}`,
    `L ${door.openLeafEnd.x} ${door.openLeafEnd.y}`,
    `M ${freeThresholdEnd.x} ${freeThresholdEnd.y}`,
    `A ${radius} ${radius} 0 0 0 ${door.openLeafEnd.x} ${door.openLeafEnd.y}`,
  ].join(" ");
}

function polygonCentroid(points: readonly MapPoint[]): MapPoint {
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function roomAriaLabel(
  name: string,
  statusLabel: RoomStatusLabel,
  outlineOnly: boolean,
): string {
  const stateDescription = statusLabel === "" ? "not yet reached" : statusLabel.toLowerCase();
  const lockDescription = outlineOnly ? ", balcony access padlocked" : "";
  return `${name}, ${stateDescription}${lockDescription}`;
}

/**
 * Where each named gift waits on the sheet. lockPin names it (the letter
 * quarter reveals the spot), collectPin settles it. Points sit on the
 * hiding furniture; keep in step with HIDING in src/pins.ts. A gift never
 * appears before its lock has opened: no spoilers ahead of the stage.
 */
const GIFT_MARKS = [
  { id: "gift-mat", lockPin: 1, collectPin: 2, label: "GIFT I", point: { x: 78, y: 402 } },
  { id: "gift-mouse", lockPin: 3, collectPin: 4, label: "GIFT II", point: { x: 408, y: 262 } },
  { id: "gift-slips", lockPin: 5, collectPin: 6, label: "GIFT III", point: { x: 186, y: 195 } },
  { id: "gift-sparkle", lockPin: 8, collectPin: 9, label: "GIFT IV", point: { x: 520, y: 430 } },
] as const;

/** The pure drawing. Motion, zoom, and chrome live in SurveyScroller. */
export function SurveyMapArt({ state }: { state: GameState }) {
  const map = deriveSurveyMap(state);
  const balconyOutlineOnly =
    map.rooms.find((room) => room.id === "balcony")?.outlineLocked ?? true;
  const objectiveRoom = map.rooms.find((room) => room.id === map.objectiveZone);
  const objectivePoint = objectiveRoom
    ? polygonCentroid(objectiveRoom.geometry.polygon)
    : null;
  const viewBox = [
    map.viewBox.x,
    map.viewBox.y,
    map.viewBox.width,
    map.viewBox.height,
  ].join(" ");

  return (
      <svg
        className="survey-map"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-labelledby="survey-map-title survey-map-description"
      >
        <title id="survey-map-title">Flat 33 architectural survey</title>
        <desc id="survey-map-description">
          Entry is the hub. The sealed front door is in the entry. The terminal
          is at the far end of the corridor. Room shading records the search:
          crimson where the lock holds, slate where it released.
        </desc>

        <defs>
          {/* The blueprint ground: a faint drafting grid on near-black. */}
          <pattern
            id="survey-grid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              className="survey-grid-line"
              d="M 20 0 L 0 0 0 20"
              fill="none"
            />
          </pattern>
        </defs>

        <rect
          className="survey-ground"
          x={map.viewBox.x}
          y={map.viewBox.y}
          width={map.viewBox.width}
          height={map.viewBox.height}
        />
        <rect
          className="survey-ground-grid"
          x={map.viewBox.x}
          y={map.viewBox.y}
          width={map.viewBox.width}
          height={map.viewBox.height}
          fill="url(#survey-grid)"
          aria-hidden="true"
        />

        {map.rooms.map((room) => {
          const { labelPoint, labelRotation, polygon } = room.geometry;
          const polygonPoints = pointList(polygon);
          const labelTransform = labelRotation === undefined
            ? undefined
            : `rotate(${labelRotation} ${labelPoint.x} ${labelPoint.y})`;
          const nameY = labelRotation === undefined ? labelPoint.y : labelPoint.y - 8;
          const stateY = labelRotation === undefined ? labelPoint.y + 18 : labelPoint.y + 8;

          return (
            <g
              key={room.id}
              className="survey-room"
              data-room={room.id}
              data-room-state={room.status}
              data-outline-only={String(room.outlineLocked)}
              role="group"
              aria-label={roomAriaLabel(
                room.label,
                room.statusLabel,
                room.outlineLocked,
              )}
            >
              <polygon className="survey-room__fill" points={polygonPoints} />
              <polygon className="survey-room__line" points={polygonPoints} />
              <text
                className="survey-room__name"
                x={labelPoint.x}
                y={nameY}
                textAnchor="middle"
                transform={labelTransform}
              >
                {room.label}
              </text>
              {room.statusLabel !== "" && (
                <text
                  className="survey-room__state"
                  x={labelPoint.x}
                  y={stateY}
                  textAnchor="middle"
                  transform={labelTransform}
                >
                  {room.statusLabel}
                </text>
              )}
            </g>
          );
        })}

        <g aria-label="Doorways and passages">
          {map.connections.map((connection) => {
            const centerline = openingCenterline(connection.opening);
            const doorClassName = connection.rooms.includes("balcony") && balconyOutlineOnly
              ? "survey-door survey-door--locked"
              : "survey-door";

            return (
              <g key={connection.id}>
                <rect
                  className="survey-opening-mask"
                  {...openingProps(connection.opening)}
                />
                {connection.passage === "open" ? (
                  <path
                    className="survey-open-passage"
                    d={passageTickPath(centerline)}
                  />
                ) : connection.door ? (
                  <path className={doorClassName} d={doorPath(connection.door)} />
                ) : null}
              </g>
            );
          })}
        </g>

        <g aria-label="Fixed furniture">
          {map.furniture.map((item) => {
            const footprint = pointList(item.footprint);
            return (
              <g key={item.id}>
                <polygon className="survey-furniture__fill" points={footprint} />
                {item.detailSegments?.map((segment, index) => (
                  <line
                    className="survey-furniture"
                    key={`${item.id}-detail-${index}`}
                    {...segmentProps(segment)}
                  />
                ))}
                <text
                  className="survey-furniture-label"
                  x={item.labelPoint.x}
                  y={item.labelPoint.y}
                  textAnchor={item.labelAnchor ?? "middle"}
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* The terminal (you are here) and the sealed front door. */}
        {map.landmarks.map((landmark) => {
          if (landmark.kind === "start") {
            const { labelPoint, point, radius } = landmark;
            return (
              <g key={landmark.id} className="survey-terminal" aria-label="The terminal: you are here">
                <circle className="survey-terminal__ring" cx={point.x} cy={point.y} r={radius} />
                <circle className="survey-terminal__ring survey-terminal__ring--outer" cx={point.x} cy={point.y} r={radius + 6} />
                <circle className="survey-terminal__core" cx={point.x} cy={point.y} r={3} />
                <text
                  className="survey-annotation"
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor="middle"
                >
                  {landmark.label}
                </text>
                <text
                  className="survey-annotation survey-annotation--dim"
                  x={labelPoint.x}
                  y={labelPoint.y + 12}
                  textAnchor="middle"
                >
                  YOU ARE HERE
                </text>
              </g>
            );
          }

          const outline = pointList(landmark.outline);
          return (
            <g key={landmark.id} aria-label="Sealed front door in the entry">
              <rect
                className="survey-opening-mask"
                {...openingProps(landmark.opening)}
              />
              <polygon
                className="survey-door survey-door--sealed"
                points={outline}
              />
              {landmark.sealBars.map((segment, index) => (
                <line
                  className="survey-door survey-door--sealed"
                  key={`${landmark.id}-seal-${index}`}
                  {...segmentProps(segment)}
                />
              ))}
              <text
                className="survey-annotation"
                x={landmark.labelPoint.x}
                y={landmark.labelPoint.y}
                textAnchor="middle"
              >
                {landmark.label}
              </text>
            </g>
          );
        })}

        {/* Gifts appear on the sheet as their locks open, and settle once
            collected. Never before the lock: no spoilers. */}
        <g aria-label="Named gifts">
          {GIFT_MARKS.map((mark) => {
            const named = state.resolvedPins.includes(mark.lockPin);
            const collected = state.resolvedPins.includes(mark.collectPin);
            if (!named) return null;
            return (
              <g
                key={mark.id}
                className={"survey-gift" + (collected ? " survey-gift--collected" : "")}
                aria-label={
                  collected
                    ? `${mark.label}, collected`
                    : `${mark.label}, waiting where the letter said`
                }
              >
                <rect
                  x={mark.point.x - 7}
                  y={mark.point.y - 7}
                  width="14"
                  height="14"
                />
                <path
                  d={`M ${mark.point.x - 7} ${mark.point.y} L ${mark.point.x + 7} ${mark.point.y} M ${mark.point.x} ${mark.point.y - 7} L ${mark.point.x} ${mark.point.y + 7}`}
                />
                <text
                  className="survey-annotation survey-gift__label"
                  x={mark.point.x}
                  y={mark.point.y - 12}
                  textAnchor="middle"
                >
                  {collected ? mark.label + " ✓" : mark.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* The objective: a pulsing mark in the room the hunt is in now. */}
        {objectivePoint && (
          <g className="survey-objective" aria-label="Your objective is in this room">
            <path
              className="survey-objective__mark"
              d={`M ${objectivePoint.x} ${objectivePoint.y - 10}
                  L ${objectivePoint.x + 10} ${objectivePoint.y}
                  L ${objectivePoint.x} ${objectivePoint.y + 10}
                  L ${objectivePoint.x - 10} ${objectivePoint.y} Z`}
            />
            <circle
              className="survey-objective__halo"
              cx={objectivePoint.x}
              cy={objectivePoint.y}
              r={16}
            />
          </g>
        )}

        {/* The compass rose: north points to the top of the sheet. */}
        <g className="survey-compass" aria-label="North points toward the top of the sheet">
          <circle className="survey-compass__ring" cx="648" cy="64" r="22" />
          <path className="survey-compass__ticks" d="M 648 42 L 648 48 M 648 80 L 648 86 M 626 64 L 632 64 M 664 64 L 670 64" />
          <path className="survey-compass__needle" d="M 648 50 L 653 68 L 648 64 L 643 68 Z" />
          <text className="survey-annotation" x="648" y="36" textAnchor="middle">
            N
          </text>
        </g>

        {/* The hand-lettered title block and its legend. */}
        <g
          className="survey-title-block"
          aria-label="Survey title block and room state key"
        >
          <rect x="454" y="40" width="186" height="118" />
          <path d="M 454 70 L 640 70" />
          <text className="survey-title" x="464" y="60">
            FLAT 33 · ARCHITECTURAL SURVEY
          </text>
          <rect
            className="survey-legend-swatch survey-legend-swatch--holds"
            x="466"
            y="80"
            width="18"
            height="9"
          />
          <text className="survey-legend-label" x="494" y="88">
            CRIMSON · THE LOCK HOLDS
          </text>
          <rect
            className="survey-legend-swatch survey-legend-swatch--released"
            x="466"
            y="100"
            width="18"
            height="9"
          />
          <text className="survey-legend-label" x="494" y="108">
            SLATE · RELEASED
          </text>
          <path
            className="survey-legend-mark"
            d="M 475 129 L 481 124.5 L 475 120 L 469 124.5 Z"
          />
          <text className="survey-legend-label" x="494" y="128">
            MARK · YOUR OBJECTIVE
          </text>
          <text className="survey-annotation survey-annotation--dim" x="464" y="150">
            THE KEEPER · MCMXCIII
          </text>
        </g>
      </svg>
  );
}
