import type { Campaign } from "../../domain/models";

export const OCTOBER_ASSETS = {
  online: "/brochure-presets/october/online.svg",
  apple: "/brochure-presets/october/apple-reseller.svg",
  hajdeWhite: "/brochure-presets/october/hajde-white.svg",
  hajde: "/brochure-presets/october/hajde.svg",
  balfin: "/brochure-presets/october/balfin.svg",
  uuu: "/brochure-presets/october/uuu-hajde.svg",
  neptun: "/brochure-presets/october/neptun-footer.svg",
} as const;

export function isOctoberBrochure(campaign: Partial<Campaign>) {
  return (
    campaign.brochureVisualStyle === "october" ||
    campaign.brochurePresetId === "neptun-october"
  );
}
