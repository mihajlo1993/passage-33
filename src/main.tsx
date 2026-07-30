import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/libre-franklin/400.css";
import "@fontsource/libre-franklin/500.css";
import "@fontsource/libre-franklin/600.css";
import "@fontsource/archivo-narrow/400.css";
import "@fontsource/archivo-narrow/600.css";
import "@fontsource/archivo-narrow/700.css";
import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/700.css";
import "@fontsource/special-elite/400.css";
import { AudioDirector } from "./audio/AudioDirector";
import { AudioProvider } from "./audio/AudioProvider";
import { GameApp } from "./components/GameApp";
import { VHSLayer } from "./fx";
import { OperatorPanel } from "./operator";
import { MAP_CONTENT_ASPECT_RATIO } from "./map/viewport";
import { colours, effects, layout, lines, motion, surfaces, typography } from "./tokens";
import "./styles.css";

const root = document.documentElement;
const cssTokens: Record<string, string> = {
  "--c-void": colours.void,
  "--c-surface": colours.surface,
  "--c-raised": colours.raised,
  "--c-hairline": colours.hairline,
  "--c-bone": colours.bone,
  "--c-bone-dim": colours.boneDim,
  "--c-rust": colours.rust,
  "--c-rust-hot": colours.rustHot,
  "--c-slate": colours.slate,
  "--c-bile": colours.bile,
  "--c-amber": colours.amber,
  "--c-chroma-red": colours.chromaRed,
  "--c-chroma-cyan": colours.chromaCyan,
  "--c-print-black": colours.printBlack,
  "--c-print-white": colours.printWhite,
  "--c-bone-bright": colours.boneBright,
  "--c-bone-muted": colours.boneMuted,
  "--c-text-hi": colours.textHi,
  "--c-text": colours.text,
  "--c-text-mute": colours.textMute,
  "--c-ink": colours.ink,
  "--c-plate": colours.plate,
  "--c-plate-hi": colours.plateHi,
  "--c-plate-lo": colours.plateLo,
  "--c-map-red": colours.mapRed,
  "--c-ecg": colours.ecg,
  "--c-ecg-caution": colours.ecgCaution,
  "--c-ecg-orange": colours.ecgOrange,
  "--line": lines.line,
  "--line-soft": lines.lineSoft,
  "--line-warm": lines.lineWarm,
  "--line-tick": lines.tick,
  "--scene-dim": surfaces.sceneDim,
  "--vignette": surfaces.vignette,
  "--glow-select": surfaces.glowSelect,
  "--glow-combine": surfaces.glowCombine,
  "--shadow-item": surfaces.shadowItem,
  "--shadow-prop": surfaces.shadowProp,
  "--font-ui": typography.fontFamily.ui,
  "--font-display": typography.fontFamily.display,
  "--font-doc": typography.fontFamily.doc,
  "--font-award": typography.fontFamily.award,
  "--tracking-ui": typography.uiLetterSpacing,
  "--tracking-caps": typography.capsLetterSpacing,
  "--tracking-title": typography.titleLetterSpacing,
  "--tracking-menu": typography.menuLetterSpacing,
  "--text-micro": typography.scalePx.micro + "px",
  "--text-small": typography.scalePx.small + "px",
  "--text-body": typography.scalePx.body + "px",
  "--text-heading": typography.scalePx.heading + "px",
  "--text-title": typography.scalePx.title + "px",
  "--text-display": typography.scalePx.display + "px",
  "--line-tight": String(typography.lineHeight.tight),
  "--line-ui": String(typography.lineHeight.ui),
  "--line-body": String(typography.lineHeight.body),
  "--motion-fast": motion.durationMs.fast + "ms",
  "--motion-base": motion.durationMs.base + "ms",
  "--motion-slow": motion.durationMs.slow + "ms",
  "--save-theatre": motion.eventMs.saveTheatre + "ms",
  "--ease-heavy": motion.easing,
  "--vhs-roll": motion.eventMs.trackingRoll + "ms",
  "--ar-image-reveal": motion.eventMs.arImageReveal + "ms",
  "--ar-herb-reward": motion.eventMs.arHerbReward + "ms",
  "--ar-hit": motion.eventMs.arHit + "ms",
  "--ar-collapse": motion.eventMs.arCollapseDuration + "ms",
  "--ar-fallback-width": effects.ar.fallbackSpriteWidthPercent + "%",
  "--ar-wall-peel-scale": String(effects.ar.wallPeelScale),
  "--ar-wall-reach-scale": String(effects.ar.wallReachScale),
  "--ar-wall-shoulder": effects.ar.wallShoulderDegrees + "deg",
  "--ar-wall-reach-x": effects.ar.wallFallbackReachXPercent + "%",
  "--ar-wall-reach-y": effects.ar.wallFallbackReachYPercent + "%",
  "--ar-herb-pulse-scale": String(effects.ar.herbPulseScale),
  "--ar-herb-lift": effects.ar.herbFallbackLiftPercent + "%",
  "--ar-monster-collapse": effects.ar.monsterCollapseDegrees + "deg",
  "--ar-shake": effects.ar.screenShakePx + "px",
  "--vhs-damage": motion.eventMs.vhsDamageSpike + "ms",
  "--vhs-drop": motion.eventMs.vhsCriticalDrop + "ms",
  "--vhs-drop-interval": motion.eventMs.vhsCriticalInterval + "ms",
  "--hairline": layout.hairlinePx + "px",
  "--frame-width": layout.frameMaxWidthPx + "px",
  "--touch-target": layout.touchTargetPx + "px",
  "--control-height": layout.controlHeightPx + "px",
  "--radius-subtle": layout.radiusPx.subtle + "px",
  "--space-hair": layout.spacingPx.hair + "px",
  "--space-xs": layout.spacingPx.xs + "px",
  "--space-sm": layout.spacingPx.sm + "px",
  "--space-md": layout.spacingPx.md + "px",
  "--space-lg": layout.spacingPx.lg + "px",
  "--space-xl": layout.spacingPx.xl + "px",
  "--space-xxl": layout.spacingPx.xxl + "px",
  "--space-huge": layout.spacingPx.huge + "px",
  "--icon-small": layout.iconSizePx.small + "px",
  "--icon-body": layout.iconSizePx.body + "px",
  "--icon-large": layout.iconSizePx.large + "px",
  "--icon-examine": layout.iconSizePx.examine + "px",
  "--map-aspect": String(MAP_CONTENT_ASPECT_RATIO),
};

Object.entries(cssTokens).forEach(([name, value]) => root.style.setProperty(name, value));
root.style.colorScheme = "dark";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AudioProvider>
      <VHSLayer disabled={false}>
        <AudioDirector />
        <GameApp />
        <OperatorPanel />
      </VHSLayer>
    </AudioProvider>
  </React.StrictMode>,
);
