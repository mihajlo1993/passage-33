"use client";

import { MEDIA_ASSETS } from "@/src/media";
import { pins, TOTAL_PIN_COUNT, RELIGHT_ACTION_PIN_ID } from "@/src/pins";
import type { GameState } from "@/src/types";
import { RelightAction } from "./RelightAction";

export interface HomeScreenProps {
  state: GameState;
  coldOpen: boolean;
  onBegin: () => void;
  onRelight: () => void | Promise<void>;
  navigate: (path: string) => void;
}

export function HomeScreen({ state, coldOpen, onBegin, onRelight, navigate }: HomeScreenProps) {
  const nextPin = pins.find((pin) => !state.resolvedPins.includes(pin.id));
  const latestPin = [...pins].reverse().find((pin) => state.resolvedPins.includes(pin.id));

  const currentZone = latestPin?.zone ?? "corridor";
  if (coldOpen) {
    const resumed = state.resolvedPins.length > 0;
    const cover = MEDIA_ASSETS.coldOpen;
    const coverUrl = cover.webp?.url;
    return (
      <section className="cold-open" data-has-cover={String(Boolean(coverUrl))} aria-labelledby="cold-title">
        {coverUrl && (
          <img
            className="cold-open__media"
            src={coverUrl}
            width={cover.width}
            height={cover.height}
            alt=""
            aria-hidden="true"
          />
        )}
        <div className="cold-open__rule" />
        <p className="eyebrow">PRIVATE EVENT // THIRTY-THREE</p>
        <div className="cold-open__copy">
          <p className="system-line">BIRTHDAY HOUSE SEVEN</p>
          <h1 id="cold-title">{resumed ? "WELCOME BACK." : "OPEN YOUR EYES."}</h1>
          <p className="host-copy">
            {resumed
              ? "There you are. I kept everything exactly where you left it. A good host never clears the table before the birthday girl has finished."
              : "Happy thirty-third. I have prepared the flat, the presents, and every unpleasant little interruption. All you need to bring is the nerve to look."}
          </p>
        </div>
        <button className="mechanical-button mechanical-button--primary" onClick={onBegin}>
          {resumed ? "RETURN TO THE HOUSE" : "BEGIN"}
        </button>
        <p className="microcopy">HEADPHONES OPTIONAL // LIGHTS OFF</p>
      </section>
    );
  }

  if (nextPin?.id === RELIGHT_ACTION_PIN_ID && currentZone === "kitchen") {
    return <RelightAction onSubmit={onRelight} />;
  }

  return (
    <section className="screen home-screen" aria-labelledby="home-title">
      <header className="screen-heading">
        <p className="eyebrow">CURRENT ARRANGEMENT</p>
        <h1 id="home-title">{nextPin ? nextPin.name : "THE PARTY IS COMPLETE"}</h1>
        <p className="screen-index">
          {nextPin
            ? "PIN " + String(nextPin.id).padStart(2, "0") + " // " + nextPin.zone
            : TOTAL_PIN_COUNT + " OF " + TOTAL_PIN_COUNT + " CONTACTS"}
        </p>
      </header>
      <div className="objective-panel">
        <span className="objective-panel__marker" aria-hidden="true" />
        <p className="host-copy">
          {latestPin
            ? latestPin.bodyText
            : "The first mark is waiting at the far end of the corridor. Point the camera at what I left there. Let the house know you have arrived."}
        </p>
        {latestPin && (
          <p className="microcopy">
            LAST CONTACT // {String(latestPin.id).padStart(2, "0")} {latestPin.name}
          </p>
        )}
      </div>
      <div className="progress-readout" aria-label={state.resolvedPins.length + " of " + TOTAL_PIN_COUNT + " contacts resolved"}>
        <span>HOUSE CONTACT</span>
        <strong>{String(state.resolvedPins.length).padStart(2, "0")} / {TOTAL_PIN_COUNT}</strong>
      </div>
      <button
        className="mechanical-button mechanical-button--primary mechanical-button--full"
        onClick={() => navigate(nextPin ? "/scan" : "/trophy")}
      >
        {nextPin ? "OPEN SCANNER" : "VIEW TROPHY"}
      </button>
      <div className="quick-grid">
        <button className="text-control" onClick={() => navigate("/map")}>CHECK FLOORPLAN</button>
        <button className="text-control" onClick={() => navigate("/inventory")}>OPEN CASE</button>
      </div>
    </section>
  );
}
