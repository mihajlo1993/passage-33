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

function roomAriaLabel(
  name: string,
  statusLabel: RoomStatusLabel,
  outlineOnly: boolean,
): string {
  const lockDescription = outlineOnly ? ", balcony access padlocked" : "";
  return `${name}, ${statusLabel.toLowerCase()}${lockDescription}`;
}

/**
 * Where each named gift waits on the sheet. lockPin names it (the letter
 * quarter reveals the spot), collectPin settles it. Points sit on the
 * hiding furniture; keep in step with HIDING in src/pins.ts.
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
          Entry is the hub. The sealed front door is in the entry. The starting
          point is at the far end of the corridor. Room shading records search
          state; no individual locations are shown.
        </desc>

        <defs>
          <pattern
            id="survey-wall-hatch"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(18)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke="var(--c-bone-dim)"
              strokeWidth="2"
            />
          </pattern>
          <pattern
            id="survey-paper-fiber"
            width="48"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 2 7 C 13 5 22 10 34 7 M 9 28 C 18 25 31 31 45 27"
              fill="none"
              stroke="var(--c-bone-dim)"
              strokeWidth="1"
              opacity="0.12"
            />
            <circle cx="39" cy="15" r="1" fill="var(--c-hairline)" />
            <circle cx="17" cy="36" r="1" fill="var(--c-bone-dim)" />
          </pattern>
        </defs>

        <rect
          x={map.viewBox.x}
          y={map.viewBox.y}
          width={map.viewBox.width}
          height={map.viewBox.height}
          fill="var(--c-surface)"
        />
        <g aria-hidden="true">
        <rect
          className="survey-paper-fiber"
          x={map.viewBox.x}
          y={map.viewBox.y}
          width={map.viewBox.width}
          height={map.viewBox.height}
          fill="url(#survey-paper-fiber)"
          aria-hidden="true"
        />
          <circle className="survey-coffee" cx="112" cy="84" r="52" />
          <circle
            className="survey-coffee survey-coffee--light"
            cx="112"
            cy="84"
            r="45"
          />
          <path
            className="survey-coffee survey-coffee--light"
            d="M 490 300 C 516 289 544 302 550 328 C 557 353 534 370 507 361"
          />
        </g>

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
              <polygon className="survey-room__hatch" points={polygonPoints} />
              <polygon className="survey-room__line" points={polygonPoints} />
              <polygon
                className="survey-room__line survey-ink-echo"
                points={polygonPoints}
                transform="translate(0.8 0.45)"
                aria-hidden="true"
              />
              <text
                className="survey-room__name"
                x={labelPoint.x}
                y={nameY}
                textAnchor="middle"
                transform={labelTransform}
              >
                {room.label}
              </text>
              <text
                className="survey-room__state"
                x={labelPoint.x}
                y={stateY}
                textAnchor="middle"
                transform={labelTransform}
              >
                {room.statusLabel}
              </text>
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
                  <>
                    <path
                      className="survey-open-passage"
                      d={passageTickPath(centerline)}
                    />
                    <path
                      className="survey-open-passage survey-ink-echo"
                      d={passageTickPath(centerline)}
                      transform="translate(0.8 0.45)"
                      aria-hidden="true"
                    />
                  </>
                ) : connection.door ? (
                  <>
                    <path className={doorClassName} d={doorPath(connection.door)} />
                    <path
                      className={`${doorClassName} survey-ink-echo`}
                      d={doorPath(connection.door)}
                      transform="translate(0.8 0.45)"
                      aria-hidden="true"
                    />
                  </>
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
                <polygon
                  className="survey-furniture survey-ink-echo"
                  points={footprint}
                  transform="translate(0.8 0.45)"
                  aria-hidden="true"
                />
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

        {/* Labels come from the tested model: START // FAR END; FRONT DOOR // SEALED. */}
        {map.landmarks.map((landmark) => {
          if (landmark.kind === "start") {
            const { crossHalfSpan, labelPoint, point, radius } = landmark;
            return (
              <g key={landmark.id} aria-label="Starting point at the far corridor end">
                <circle className="survey-start" cx={point.x} cy={point.y} r={radius} />
                <path
                  className="survey-start"
                  d={`M ${point.x - crossHalfSpan} ${point.y} L ${point.x + crossHalfSpan} ${point.y} M ${point.x} ${point.y - crossHalfSpan} L ${point.x} ${point.y + crossHalfSpan}`}
                />
                <text
                  className="survey-annotation"
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor="middle"
                >
                  {landmark.label}
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
              <polygon
                className="survey-door survey-door--sealed survey-ink-echo"
                points={outline}
                transform="translate(0.8 0.45)"
                aria-hidden="true"
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
            collected. Marker points sit on the furniture that hides them;
            keep in step with HIDING in src/pins.ts. */}
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

        <g className="survey-north" aria-label="North points toward the top of the sheet">
          <path d="M 660 76 L 660 42 L 652 57 M 660 42 L 668 57" />
          <text className="survey-annotation" x="660" y="34" textAnchor="middle">
            N
          </text>
        </g>

        <g
          className="survey-title-block"
          aria-label="Survey title block and room state key"
        >
          <rect x="474" y="40" width="166" height="110" />
          <path d="M 474 66 L 640 66 M 474 136 L 640 136" />
          <text className="survey-title" x="484" y="58">
            FLAT 33
          </text>
          <text className="survey-title" x="630" y="58" textAnchor="end">
            SURVEY
          </text>
          <rect
            className="survey-legend-swatch survey-legend-swatch--unresolved"
            x="486"
            y="76"
            width="18"
            height="9"
          />
          <text className="survey-legend-label" x="514" y="84">
            UNRESOLVED
          </text>
          <rect
            className="survey-legend-swatch survey-legend-swatch--cleared"
            x="486"
            y="96"
            width="18"
            height="9"
          />
          <text className="survey-legend-label" x="514" y="104">
            CLEARED
          </text>
          <rect
            className="survey-legend-swatch survey-legend-swatch--unentered"
            x="486"
            y="116"
            width="18"
            height="9"
          />
          <text className="survey-legend-label" x="514" y="124">
            UNENTERED
          </text>
          <text className="survey-annotation" x="484" y="146">
            ENTRY HUB
          </text>
          <text className="survey-annotation" x="630" y="146" textAnchor="end">
            SEALED
          </text>
        </g>
      </svg>
  );
}
