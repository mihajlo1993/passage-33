import type {
  AudioBufferLike,
  AudioContextLike,
  AudioGraph,
  AudioNodeLike,
  AudioParamLike,
} from "./types";

export const ZONE_IR_CROSSFADE_SECONDS = 0.6;

function setInitialValue(parameter: AudioParamLike, value: number): void {
  parameter.value = value;
}

export function createAudioGraph(context: AudioContextLike): AudioGraph {
  const master = context.createGain();
  const ambientBus = context.createGain();
  const oneshotBus = context.createGain();
  const voiceBus = context.createGain();
  const ambientDry = context.createGain();
  const oneshotDry = context.createGain();
  const firstConvolver = context.createConvolver();
  const secondConvolver = context.createConvolver();
  const firstWetGain = context.createGain();
  const secondWetGain = context.createGain();

  setInitialValue(master.gain, 1);
  setInitialValue(ambientBus.gain, 1);
  setInitialValue(oneshotBus.gain, 1);
  setInitialValue(voiceBus.gain, 1);
  setInitialValue(ambientDry.gain, 1);
  setInitialValue(oneshotDry.gain, 1);
  setInitialValue(firstWetGain.gain, 0);
  setInitialValue(secondWetGain.gain, 0);

  firstConvolver.normalize = true;
  secondConvolver.normalize = true;

  master.connect(context.destination);
  ambientBus.connect(ambientDry);
  ambientDry.connect(master);
  oneshotBus.connect(oneshotDry);
  oneshotDry.connect(master);
  voiceBus.connect(master);

  ambientBus.connect(firstConvolver);
  ambientBus.connect(secondConvolver);
  oneshotBus.connect(firstConvolver);
  oneshotBus.connect(secondConvolver);
  firstConvolver.connect(firstWetGain);
  secondConvolver.connect(secondWetGain);
  firstWetGain.connect(master);
  secondWetGain.connect(master);

  return {
    master,
    ambientBus,
    oneshotBus,
    voiceBus,
    ambientDry,
    oneshotDry,
    wetSlots: [
      { convolver: firstConvolver, gain: firstWetGain },
      { convolver: secondConvolver, gain: secondWetGain },
    ],
    activeWetSlot: null,
  };
}

/**
 * Holds the current value when supported, then installs one deterministic
 * linear ramp. The fallback is sufficient for the older fake/native surface.
 */
export function rampAudioParam(
  parameter: AudioParamLike,
  value: number,
  startTime: number,
  durationSeconds: number,
  explicitStart?: number,
): void {
  if (explicitStart === undefined && parameter.cancelAndHoldAtTime) {
    parameter.cancelAndHoldAtTime(startTime);
  } else {
    parameter.cancelScheduledValues(startTime);
    parameter.setValueAtTime(explicitStart ?? parameter.value, startTime);
  }
  parameter.linearRampToValueAtTime(value, startTime + durationSeconds);
}

export function crossfadeImpulse(
  graph: AudioGraph,
  buffer: AudioBufferLike,
  wetGain: number,
  startTime: number,
): void {
  const nextIndex: 0 | 1 = graph.activeWetSlot === 0 ? 1 : 0;
  const next = graph.wetSlots[nextIndex];
  next.convolver.buffer = buffer;
  rampAudioParam(
    next.gain.gain,
    wetGain,
    startTime,
    ZONE_IR_CROSSFADE_SECONDS,
    0,
  );

  if (graph.activeWetSlot !== null) {
    const previous = graph.wetSlots[graph.activeWetSlot];
    rampAudioParam(
      previous.gain.gain,
      0,
      startTime,
      ZONE_IR_CROSSFADE_SECONDS,
    );
  }

  graph.activeWetSlot = nextIndex;
}

function safeDisconnect(node: AudioNodeLike): void {
  try {
    node.disconnect();
  } catch {
    // A partially constructed or already disconnected graph is still clean.
  }
}

export function disconnectAudioGraph(graph: AudioGraph): void {
  const nodes: readonly AudioNodeLike[] = [
    graph.ambientBus,
    graph.oneshotBus,
    graph.voiceBus,
    graph.ambientDry,
    graph.oneshotDry,
    graph.wetSlots[0].convolver,
    graph.wetSlots[0].gain,
    graph.wetSlots[1].convolver,
    graph.wetSlots[1].gain,
    graph.master,
  ];
  for (const node of nodes) safeDisconnect(node);
}
