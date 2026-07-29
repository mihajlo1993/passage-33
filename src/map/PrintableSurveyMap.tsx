import {
  mapFurniture,
  mapLandmarks,
  mapViewBox,
  openingCenterline,
  roomConnections,
  roomDefinitions,
} from "./model";
import type {
  DoorGeometry,
  MapPoint,
  MapSegment,
  OpeningBounds,
} from "./types";
import type { ZoneId } from "../types";

export const HOST_ROOM_NAMES: Readonly<Record<ZoneId, string>> = {
  corridor: "THE WAKING HALL",
  bathroom: "THE PREPARATION ROOM",
  entry: "THE SEALED WELCOME",
  living: "THE SCREENING PARLOUR",
  balcony: "THE LOSER'S VIEW",
  kitchen: "THE BIRTHDAY KITCHEN",
};

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

export function PrintableSurveyMap() {
  const viewBox = [
    mapViewBox.x,
    mapViewBox.y,
    mapViewBox.width,
    mapViewBox.height,
  ].join(" ");

  return (
    <svg
      className="print-survey"
      viewBox={viewBox}
      role="img"
      aria-labelledby="print-survey-title print-survey-description"
    >
      <title id="print-survey-title">The Host's master survey</title>
      <desc id="print-survey-description">
        A black and white plan of the flat, drawn from the same room,
        connection, furniture, and landmark geometry as the in-app survey.
      </desc>

      <defs>
        <pattern
          id="print-survey-wall-hatch"
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
            className="print-survey__hatch-line"
          />
        </pattern>
      </defs>

      {roomDefinitions.map((room) => {
        const points = pointList(room.geometry.polygon);
        const { labelPoint, labelRotation } = room.geometry;
        const labelTransform = labelRotation === undefined
          ? undefined
          : `rotate(${labelRotation} ${labelPoint.x} ${labelPoint.y})`;
        return (
          <g
            key={room.id}
            className="print-survey__room"
            data-room={room.id}
          >
            <polygon
              className="print-survey__wall-hatch"
              points={points}
              fill="none"
            />
            <polygon
              className="print-survey__room-outline"
              points={points}
              fill="none"
            />
            <text
              className="print-survey__room-name"
              x={labelPoint.x}
              y={labelPoint.y}
              textAnchor="middle"
              transform={labelTransform}
            >
              {HOST_ROOM_NAMES[room.id]}
            </text>
          </g>
        );
      })}

      <g aria-label="Doorways and passages">
        {roomConnections.map((connection) => {
          const centerline = openingCenterline(connection.opening);
          return (
          <g key={connection.id}>
            <rect
              className="print-survey__opening-mask"
              {...openingProps(connection.opening)}
            />
            {connection.passage === "door" && connection.door ? (
              <path
                className="print-survey__door"
                d={doorPath(connection.door)}
                fill="none"
              />
            ) : (
              <line
                className="print-survey__open-passage"
                {...segmentProps(centerline)}
              />
            )}
          </g>
          );
        })}
      </g>

      <g aria-label="Fixed furniture">
        {mapFurniture.map((item) => (
          <g key={item.id}>
            <polygon
              className="print-survey__furniture"
              points={pointList(item.footprint)}
              fill="none"
            />
            {item.detailSegments?.map((segment, index) => (
              <line
                className="print-survey__furniture"
                key={`${item.id}-detail-${index}`}
                {...segmentProps(segment)}
              />
            ))}
            <text
              className="print-survey__furniture-label"
              x={item.labelPoint.x}
              y={item.labelPoint.y}
              textAnchor={item.labelAnchor ?? "middle"}
            >
              {item.label}
            </text>
          </g>
        ))}
      </g>

      {mapLandmarks.map((landmark) => {
        if (landmark.kind === "start") {
          return (
            <g key={landmark.id}>
              <circle
                className="print-survey__landmark"
                cx={landmark.point.x}
                cy={landmark.point.y}
                r={landmark.radius}
                fill="none"
              />
              <path
                className="print-survey__landmark"
                d={`M ${landmark.point.x - landmark.crossHalfSpan} ${landmark.point.y} L ${landmark.point.x + landmark.crossHalfSpan} ${landmark.point.y} M ${landmark.point.x} ${landmark.point.y - landmark.crossHalfSpan} L ${landmark.point.x} ${landmark.point.y + landmark.crossHalfSpan}`}
                fill="none"
              />
              <text
                className="print-survey__annotation"
                x={landmark.labelPoint.x}
                y={landmark.labelPoint.y}
                textAnchor="middle"
              >
                {landmark.label}
              </text>
            </g>
          );
        }

        return (
          <g key={landmark.id}>
            <rect
              className="print-survey__opening-mask"
              {...openingProps(landmark.opening)}
            />
            <polygon
              className="print-survey__landmark"
              points={pointList(landmark.outline)}
              fill="none"
            />
            {landmark.sealBars.map((segment, index) => (
              <line
                className="print-survey__landmark"
                key={`${landmark.id}-seal-${index}`}
                {...segmentProps(segment)}
              />
            ))}
            <text
              className="print-survey__annotation"
              x={landmark.labelPoint.x}
              y={landmark.labelPoint.y}
              textAnchor="middle"
            >
              {landmark.label}
            </text>
          </g>
        );
      })}

      <g className="print-survey__north" aria-label="North">
        <path d="M 660 76 L 660 42 L 652 57 M 660 42 L 668 57" fill="none" />
        <text x="660" y="34" textAnchor="middle">
          N
        </text>
      </g>

      <g
        className="print-survey__title-block"
        aria-label="The Host's title block"
      >
        <rect x="474" y="40" width="166" height="110" fill="none" />
        <path d="M 474 66 L 640 66" fill="none" />
        <text className="print-survey__title" x="484" y="58">
          BAKER HOUSE
        </text>
        <text x="484" y="82">HOST'S MASTER SURVEY</text>
        <text x="484" y="99">BIRTHDAY GIRL</text>
        <text x="484" y="116">ENTRY HUB</text>
        <text x="484" y="133">EXIT SEALED</text>
        <text x="484" y="146">NOT FOR EGRESS</text>
      </g>
    </svg>
  );
}
