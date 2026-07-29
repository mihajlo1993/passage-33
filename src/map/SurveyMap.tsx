"use client";

import type { GameState } from "../types";
import { deriveSurveyMap } from "./model";
import type { DoorGeometry, MapPoint, MapSegment, RoomStatusLabel } from "./types";
import { useMapViewport } from "./useMapViewport";

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

export function SurveyMap({ state }: { state: GameState }) {
  const map = deriveSurveyMap(state);
  const balconyOutlineOnly =
    map.rooms.find((room) => room.id === "balcony")?.outlineLocked ?? true;
  const { handlers, reset, style } = useMapViewport();
  const viewBox = [
    map.viewBox.x,
    map.viewBox.y,
    map.viewBox.width,
    map.viewBox.height,
  ].join(" ");

  return (
    <div
      className="survey-frame"
      aria-label="Hand-drafted survey map of the flat"
      onDoubleClick={reset}
      {...handlers}
    >
      <svg
        className="survey-map"
        style={style}
        viewBox={viewBox}
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
          <circle className="survey-coffee" cx="115" cy="108" r="71" />
          <circle
            className="survey-coffee survey-coffee--light"
            cx="115"
            cy="108"
            r="62"
          />
          <path
            className="survey-coffee survey-coffee--light"
            d="M 710 126 C 746 113 784 131 793 165 C 802 199 770 223 733 210"
          />
        </g>

        {map.rooms.map((room) => {
          const { labelPoint, polygon } = room.geometry;
          const polygonPoints = pointList(polygon);

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
                y={labelPoint.y}
                textAnchor="middle"
              >
                {room.label}
              </text>
              <text
                className="survey-room__state"
                x={labelPoint.x}
                y={labelPoint.y + 18}
                textAnchor="middle"
              >
                {room.statusLabel}
              </text>
            </g>
          );
        })}

        <g aria-label="Doorways and passages">
          {map.connections.map((connection) => {
            const doorClassName = connection.rooms.includes("balcony") && balconyOutlineOnly
              ? "survey-door survey-door--locked"
              : "survey-door";

            return (
              <g key={connection.id}>
                <line
                  className="survey-opening-mask"
                  {...segmentProps(connection.opening)}
                />
                {connection.passage === "open" ? (
                  <>
                    <path
                      className="survey-open-passage"
                      d={passageTickPath(connection.opening)}
                    />
                    <path
                      className="survey-open-passage survey-ink-echo"
                      d={passageTickPath(connection.opening)}
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
              <line
                className="survey-opening-mask"
                {...segmentProps(landmark.threshold)}
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

        <g className="survey-north" aria-label="North points toward the top of the sheet">
          <path d="M 823 108 L 823 55 L 812 76 M 823 55 L 834 76" />
          <text className="survey-annotation" x="823" y="46" textAnchor="middle">
            N
          </text>
        </g>

        <g className="survey-title-block" aria-label="Completed architectural survey title block">
          <rect x="548" y="507" width="329" height="70" />
          <path d="M 548 534 L 877 534 M 710 534 L 710 577" />
          <text className="survey-title" x="560" y="527">
            FLAT 33 // ARCHITECTURAL SURVEY
          </text>
          <text className="survey-annotation" x="560" y="551">
            FINAL FIELD DRAWING
          </text>
          <text className="survey-annotation" x="560" y="568">
            NOT FOR EGRESS
          </text>
          <text className="survey-annotation" x="722" y="551">
            ENTRY IS HUB
          </text>
          <text className="survey-annotation" x="722" y="568">
            DOOR STAYS SHUT
          </text>
        </g>
      </svg>
    </div>
  );
}
