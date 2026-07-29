"use client";

import type { GameState, ZoneId } from "../types";
import { deriveRoomStates } from "./model";
import { useMapViewport } from "./useMapViewport";

interface RoomGeometry {
  id: ZoneId;
  name: string;
  path: string;
  label: readonly [number, number];
}

const ROOM_GEOMETRY: readonly RoomGeometry[] = [
  {
    id: "corridor",
    name: "CORRIDOR",
    path: "M 39 338 L 340 341 L 338 481 L 41 478 Z",
    label: [190, 401],
  },
  {
    id: "bathroom",
    name: "BATHROOM",
    path: "M 169 166 L 342 169 L 340 341 L 171 338 Z",
    label: [255, 238],
  },
  {
    id: "entry",
    name: "ENTRY",
    path: "M 339 300 L 493 303 L 490 482 L 338 480 Z",
    label: [414, 369],
  },
  {
    id: "kitchen",
    name: "KITCHEN",
    path: "M 339 67 L 493 70 L 491 303 L 340 300 Z",
    label: [416, 137],
  },
  {
    id: "living",
    name: "LIVING",
    path: "M 490 168 L 772 171 L 770 482 L 490 480 Z",
    label: [632, 226],
  },
  {
    id: "balcony",
    name: "BALCONY",
    path: "M 771 189 L 879 191 L 876 462 L 770 460 Z",
    label: [824, 242],
  },
] as const;

function roomStateLabel(state: string): string {
  if (state === "cleared") return "CLEARED";
  if (state === "unresolved") return "SEARCHING";
  return "UNSEEN";
}

function roomAriaLabel(name: string, state: string, outlineOnly: boolean): string {
  if (outlineOnly) return name + ", not accessible, padlocked";
  if (state === "cleared") return name + ", cleared";
  if (state === "unresolved") return name + ", search incomplete";
  return name + ", not yet entered";
}

export function SurveyMap({ state }: { state: GameState }) {
  const roomsById = new Map(
    deriveRoomStates(state).map((room) => [room.id, room] as const),
  );
  const balconyOutlineOnly = roomsById.get("balcony")?.outlineLocked ?? true;
  const { handlers, reset, style } = useMapViewport();

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
        viewBox="0 0 900 600"
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
        </defs>

        <rect width="900" height="600" fill="var(--c-surface)" />
        <g aria-hidden="true">
          <circle className="survey-coffee" cx="115" cy="108" r="71" />
          <circle className="survey-coffee survey-coffee--light" cx="115" cy="108" r="62" />
          <path
            className="survey-coffee survey-coffee--light"
            d="M 710 126 C 746 113 784 131 793 165 C 802 199 770 223 733 210"
          />
        </g>

        {ROOM_GEOMETRY.map((room) => {
          const roomState = roomsById.get(room.id);
          if (!roomState) return null;
          const outlineOnly = roomState.outlineLocked;
          return (
            <g
              key={room.id}
              className="survey-room"
              data-room={room.id}
              data-room-state={roomState.status}
              data-outline-only={String(outlineOnly)}
              role="group"
              aria-label={roomAriaLabel(room.name, roomState.status, outlineOnly)}
            >
              <path className="survey-room__fill" d={room.path} />
              <path className="survey-room__hatch" d={room.path} />
              <path className="survey-room__line" d={room.path} />
              <text
                className="survey-room__name"
                x={room.label[0]}
                y={room.label[1]}
                textAnchor="middle"
              >
                {room.name}
              </text>
              <text
                className="survey-room__state"
                x={room.label[0]}
                y={room.label[1] + 18}
                textAnchor="middle"
              >
                {outlineOnly ? "PADLOCKED" : roomStateLabel(roomState.status)}
              </text>
            </g>
          );
        })}

        <g aria-label="Doorways and passages">
          <line className="survey-opening-mask" x1="490" y1="350" x2="490" y2="425" />
          <path className="survey-open-passage" d="M 486 350 L 494 350 M 486 425 L 494 425" />
          <line className="survey-opening-mask" x1="339" y1="385" x2="339" y2="445" />
          <path className="survey-open-passage" d="M 335 385 L 343 385 M 335 445 L 343 445" />

          <line className="survey-opening-mask" x1="398" y1="301" x2="446" y2="301" />
          <path className="survey-door" d="M 398 301 L 398 255 M 444 301 A 46 46 0 0 0 398 255" />

          <line className="survey-opening-mask" x1="229" y1="339" x2="277" y2="340" />
          <path className="survey-door" d="M 230 340 L 230 294 M 276 340 A 46 46 0 0 0 230 294" />

          <line className="survey-opening-mask" x1="771" y1="278" x2="771" y2="332" />
          <path
            className={balconyOutlineOnly ? "survey-door survey-door--locked" : "survey-door"}
            d="M 771 279 L 719 279 M 771 331 A 52 52 0 0 0 719 279"
          />

          <line className="survey-opening-mask" x1="384" y1="481" x2="442" y2="481" />
          <path className="survey-door survey-door--sealed" d="M 385 481 L 385 532 L 441 532 L 441 481 M 398 486 L 398 527 M 412 486 L 412 527 M 427 486 L 427 527" />
          <text className="survey-annotation" x="413" y="548" textAnchor="middle">
            FRONT DOOR // SEALED
          </text>
        </g>

        <g aria-label="Fixed furniture">
          <path className="survey-furniture__fill" d="M 51 352 L 80 353 L 78 464 L 49 462 Z" />
          <path className="survey-furniture" d="M 56 367 L 74 367 M 56 383 L 74 383 M 56 399 L 74 399 M 56 415 L 74 415 M 56 431 L 74 431 M 56 447 L 74 447" />
          <text className="survey-furniture-label" x="91" y="458">THIN CUPBOARD</text>

          <rect className="survey-furniture__fill" x="185" y="181" width="90" height="17" />
          <line className="survey-furniture" x1="189" y1="206" x2="270" y2="206" />
          <text className="survey-furniture-label" x="230" y="218" textAnchor="middle">MIRROR / CABINET</text>

          <path className="survey-furniture" d="M 366 346 L 379 325 L 392 346 M 379 325 L 379 401 M 363 363 L 395 363 M 368 401 L 390 401" />
          <text className="survey-furniture-label" x="379" y="416" textAnchor="middle">HANGER</text>

          <rect className="survey-furniture__fill" x="508" y="187" width="46" height="104" />
          <path className="survey-furniture" d="M 508 221 L 554 221 M 508 256 L 554 256 M 531 187 L 531 291" />
          <text className="survey-furniture-label" x="531" y="305" textAnchor="middle">KALLAX</text>

          <rect className="survey-furniture__fill" x="593" y="275" width="99" height="61" />
          <path className="survey-furniture" d="M 602 336 L 598 350 M 683 336 L 688 350" />
          <text className="survey-furniture-label" x="642" y="311" textAnchor="middle">TABLE</text>

          <path className="survey-furniture__fill" d="M 564 421 L 736 421 L 736 350 L 688 350 L 688 389 L 622 389 L 622 350 L 564 350 Z" />
          <path className="survey-furniture" d="M 573 405 L 727 405 M 578 350 L 578 389 M 721 350 L 721 405" />
          <text className="survey-furniture-label" x="648" y="448" textAnchor="middle">SECTIONAL // NOTCH</text>

          <rect className="survey-furniture__fill" x="698" y="188" width="57" height="28" />
          <line className="survey-furniture" x1="706" y1="221" x2="747" y2="221" />
          <text className="survey-furniture-label" x="726" y="232" textAnchor="middle">TV UNIT</text>
        </g>

        <g aria-label="Starting point at the far corridor end">
          <circle className="survey-start" cx="109" cy="414" r="16" />
          <path className="survey-start" d="M 83 414 L 135 414 M 109 388 L 109 440" />
          <text className="survey-annotation" x="109" y="452" textAnchor="middle">START // FAR END</text>
        </g>

        <g className="survey-north" aria-label="North points toward the top of the sheet">
          <path d="M 823 108 L 823 55 L 812 76 M 823 55 L 834 76" />
          <text className="survey-annotation" x="823" y="46" textAnchor="middle">N</text>
        </g>

        <g className="survey-title-block" aria-label="Survey title block">
          <rect x="646" y="507" width="231" height="70" />
          <path d="M 646 534 L 877 534 M 760 534 L 760 577" />
          <text className="survey-title" x="658" y="527">FLAT 33 // HOLDING COPY</text>
          <text className="survey-annotation" x="658" y="551">NOT FOR EGRESS</text>
          <text className="survey-annotation" x="658" y="568">SCALE UNTRUSTWORTHY</text>
          <text className="survey-annotation" x="770" y="551">ENTRY IS HUB</text>
          <text className="survey-annotation" x="770" y="568">DOOR STAYS SHUT</text>
        </g>
      </svg>
    </div>
  );
}
