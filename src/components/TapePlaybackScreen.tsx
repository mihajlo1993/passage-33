"use client";

import {
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";

import type { VoicePlaybackHandle } from "../audio/types";
import { useAudio } from "../audio/useAudio";
import { getVHSHealthProfile, useVHS } from "../fx";
import {
  MEDIA_ASSETS,
  TAPE_STILLS,
  canUserSkipTape,
  createTapePlaybackState,
  formatTapeTimecode,
  tapeStillIndexAtVoicePosition,
  tapeStateDurationMs,
  transitionTapePlayback,
} from "../media";
import { effects, motion } from "../tokens";

export interface TapePlaybackScreenProps {
  /** Current health is used only to restore the global VHS profile on exit. */
  readonly health: number;
  /** Resolve pin 12 here. Return false to keep the screen black if resolution failed. */
  readonly onComplete: () => boolean | void | Promise<boolean | void>;
  /** Called only after onComplete succeeds; the shell should navigate to /map. */
  readonly onExit: () => void;
  /** Claims pin 12's persisted one-shot voice and starts it when available. */
  readonly startVoice: () => Promise<VoicePlaybackHandle | null>;
  /** Optional monotonically increasing operator signal; it jumps to still 07. */
  readonly operatorSkipToken?: number;
}

type TapeTimingMode = "pending" | "voice" | "fallback";

export function TapePlaybackScreen({
  health,
  onComplete,
  onExit,
  startVoice,
  operatorSkipToken = 0,
}: TapePlaybackScreenProps) {
  const [state, dispatch] = useReducer(transitionTapePlayback, undefined, createTapePlaybackState);
  const [failedImages, setFailedImages] = useState<ReadonlySet<string>>(() => new Set());
  const [headSwitching, setHeadSwitching] = useState(false);
  const [completionFailed, setCompletionFailed] = useState(false);
  const [timingMode, setTimingMode] = useState<TapeTimingMode>("pending");
  const vhs = useVHS();
  const audio = useAudio();
  const startedAtRef = useRef<number>(0);
  const latestHealthRef = useRef(health);
  latestHealthRef.current = health;
  const priorFrameRef = useRef<string | null>(null);
  const headSwitchTimerRef = useRef<number | null>(null);
  const completionRequestedRef = useRef(false);
  const mountedRef = useRef(true);
  const priorOperatorSkipToken = useRef(operatorSkipToken);
  const voicePlaybackRef = useRef<VoicePlaybackHandle | null>(null);
  const voiceStartTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    startedAtRef.current = performance.now();
    vhs.setIntensity(effects.tape.forcedVhsIntensity);
    vhs.setTimecode("PLAY " + formatTapeTimecode(0));
    void audio.play("write").catch(() => undefined);

    const timecodeTimer = window.setInterval(() => {
      const playback = voicePlaybackRef.current;
      const elapsedMs = playback
        ? playback.positionSeconds() * 1_000
        : performance.now() - startedAtRef.current;
      if (playback) {
        const stillIndex = tapeStillIndexAtVoicePosition(
          playback.positionSeconds(),
          playback.durationSeconds,
        );
        if (stillIndex !== null) dispatch({ type: "voice-position", stillIndex });
      }
      vhs.setTimecode(
        "PLAY " + formatTapeTimecode(elapsedMs),
      );
    }, motion.tape.timecodeTickMs);

    return () => {
      mountedRef.current = false;
      window.clearInterval(timecodeTimer);
      if (headSwitchTimerRef.current !== null) {
        window.clearTimeout(headSwitchTimerRef.current);
        headSwitchTimerRef.current = null;
      }
      vhs.setTimecode(null);
      vhs.setIntensity(getVHSHealthProfile(latestHealthRef.current).intensity);
    };
  }, [audio, vhs]);

  useEffect(() => {
    let active = true;
    voiceStartTimerRef.current = window.setTimeout(() => {
      voiceStartTimerRef.current = null;
      void startVoice()
        .then((playback) => {
          if (!active) {
            playback?.stop();
            return;
          }
          if (playback === null) {
            startedAtRef.current = performance.now();
            setTimingMode("fallback");
            return;
          }

          voicePlaybackRef.current = playback;
          startedAtRef.current = performance.now()
            - playback.positionSeconds() * 1_000;
          setTimingMode("voice");
          void playback.finished.then(() => {
            if (!active || voicePlaybackRef.current !== playback) return;
            voicePlaybackRef.current = null;
            dispatch({ type: "voice-ended" });
          });
        })
        .catch(() => {
          if (!active) return;
          startedAtRef.current = performance.now();
          setTimingMode("fallback");
        });
    }, 0);

    return () => {
      active = false;
      if (voiceStartTimerRef.current !== null) {
        window.clearTimeout(voiceStartTimerRef.current);
        voiceStartTimerRef.current = null;
      }
      voicePlaybackRef.current?.stop();
      voicePlaybackRef.current = null;
    };
  }, [startVoice]);

  useEffect(() => {
    if (state.phase === "playing" && timingMode !== "fallback") return;
    const duration = tapeStateDurationMs(state);
    if (duration === null) return;
    const timer = window.setTimeout(() => dispatch("timer"), duration);
    return () => window.clearTimeout(timer);
  }, [state, timingMode]);

  useEffect(() => {
    const frameKey = `${state.phase}:${state.stillIndex}`;
    if (priorFrameRef.current === null) {
      priorFrameRef.current = frameKey;
      return;
    }
    if (priorFrameRef.current === frameKey) return;
    priorFrameRef.current = frameKey;
    vhs.dropFrames(motion.tape.headSwitchMs);
    void audio.play("dial-tick").catch(() => undefined);
    setHeadSwitching(true);
    if (headSwitchTimerRef.current !== null) {
      window.clearTimeout(headSwitchTimerRef.current);
    }
    headSwitchTimerRef.current = window.setTimeout(() => {
      setHeadSwitching(false);
      headSwitchTimerRef.current = null;
    }, motion.tape.headSwitchMs);
  }, [audio, state.phase, state.stillIndex, vhs]);

  useEffect(() => {
    if (operatorSkipToken === priorOperatorSkipToken.current) return;
    priorOperatorSkipToken.current = operatorSkipToken;
    dispatch("operator-skip");
  }, [operatorSkipToken]);

  useEffect(() => {
    if (state.phase !== "complete" || completionRequestedRef.current) return;
    completionRequestedRef.current = true;
    void Promise.resolve().then(onComplete)
      .then((completed) => {
        if (!mountedRef.current) return;
        if (completed === false) {
          setCompletionFailed(true);
          return;
        }
        onExit();
      })
      .catch(() => {
        if (mountedRef.current) setCompletionFailed(true);
      });
  }, [onComplete, onExit, state.phase]);

  const still = TAPE_STILLS[state.stillIndex];
  const asset = still ? MEDIA_ASSETS[still.assetId] : null;
  const showImage = state.phase === "playing"
    && still
    && asset?.available === true
    && asset.webp !== null
    && !failedImages.has(still.assetId);

  const markImageFailed = (assetId: string) => {
    setFailedImages((current) => {
      const next = new Set(current);
      next.add(assetId);
      return next;
    });
  };

  return (
    <section
      className="tape-playback"
      data-phase={state.phase}
      data-head-switching={String(headSwitching)}
      aria-label="Recovered cassette playback"
    >
      {state.phase === "playing" && still && (
        <article className="tape-playback__frame" aria-live="off">
          {showImage && asset?.available ? (
            <div className="tape-playback__picture">
              <img
                src={asset.webp!.url}
                width={asset.width}
                height={asset.height}
                alt={still.alt}
                onError={() => markImageFailed(still.assetId)}
              />
            </div>
          ) : (
            <div className="tape-playback__missing" role="img" aria-label={still.alt}>
              <span>TRACK {String(still.id).padStart(2, "0")} // IMAGE LOST</span>
            </div>
          )}
          <div className="tape-playback__narration">
            {still.narration.map((line) => <p key={line}>{line}</p>)}
          </div>
          {canUserSkipTape(state) && (
            <button className="tape-playback__skip" onClick={() => dispatch("user-skip")}>
              SKIP TO THE END
            </button>
          )}
        </article>
      )}
      <div className="tape-playback__head-switch" aria-hidden="true" />
      {state.phase !== "playing" && (
        <div className="tape-playback__blackout" role="status">
          {completionFailed && <p>THE TAPE WILL NOT RELEASE.</p>}
        </div>
      )}
    </section>
  );
}
