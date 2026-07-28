import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/archivo-narrow/400.css";
import "@fontsource/archivo-narrow/600.css";
import "@fontsource/archivo-narrow/700.css";
import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/700.css";
import "@fontsource/special-elite/400.css";
import { GameApp } from "./components/GameApp";
import { colours, layout, motion, typography } from "./tokens";
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
  "--font-ui": typography.fontFamily.ui,
  "--font-doc": typography.fontFamily.doc,
  "--font-award": typography.fontFamily.award,
  "--tracking-ui": typography.uiLetterSpacing,
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
};

Object.entries(cssTokens).forEach(([name, value]) => root.style.setProperty(name, value));
root.style.colorScheme = "dark";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GameApp />
  </React.StrictMode>,
);
