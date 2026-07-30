"use client";

import { MEDIA_ASSETS } from "@/src/media";
import type { MediaAssetId } from "@/src/media";
import type { ZoneId } from "@/src/types";

/**
 * The world behind the slab. Every screen keeps a dimmed scene visible under
 * the UI; a missing plate degrades to true black, which is itself canon.
 */
const PLATE_BY_ROUTE: Readonly<Partial<Record<string, MediaAssetId>>> = {
  "/notes": "plateDocument" as MediaAssetId,
  "/save": "plateSave" as MediaAssetId,
  "/trophy": "plateCredits" as MediaAssetId,
};

const PLATE_BY_ZONE: Readonly<Record<ZoneId, MediaAssetId>> = {
  corridor: "plateCorridor" as MediaAssetId,
  bathroom: "plateBathroom" as MediaAssetId,
  entry: "plateEntry" as MediaAssetId,
  living: "plateLiving" as MediaAssetId,
  balcony: "plateBalcony" as MediaAssetId,
  kitchen: "plateKitchen" as MediaAssetId,
};

function plateUrl(id: MediaAssetId | undefined): string | null {
  if (!id) return null;
  const record = (MEDIA_ASSETS as Record<string, { webp?: { url: string } | null } | undefined>)[id];
  return record?.webp?.url ?? null;
}

export interface ScenePlateProps {
  route: string;
  zone: ZoneId;
  coldOpen?: boolean;
}

export function ScenePlate({ route, zone, coldOpen = false }: ScenePlateProps) {
  if (route === "/ar" || route === "/tape" || route === "/scan") return null;
  const assetId = coldOpen
    ? ("plateTitle" as MediaAssetId)
    : PLATE_BY_ROUTE[route] ?? PLATE_BY_ZONE[zone];
  const url = plateUrl(assetId);
  return (
    <div
      className="screen-plate"
      aria-hidden="true"
      style={url ? { backgroundImage: `url(${url})` } : undefined}
    />
  );
}
