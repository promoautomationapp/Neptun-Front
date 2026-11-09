import type { Campaign } from "../../domain/models";
import { pageBackgroundReadability } from "./pageBackground";

export type BrandLogoMode = NonNullable<Campaign["brandLogoMode"]>;

export const DARK_BRAND_LOGO_FILTER =
  "brightness(0) invert(20.39675206%) sepia(6.28108265%) hue-rotate(70.97620239deg)";

/** Matches the monochrome logos used by the brochure, without changing source assets. */
export function brandLogoAppearance(
  campaign: Partial<Campaign>,
  kind: "cover" | "product",
) {
  const mode = campaign.brandLogoMode || "auto";
  const resolved =
    mode === "auto"
      ? pageBackgroundReadability(campaign, kind).light
        ? "dark"
        : "white"
      : mode;
  return {
    mode: resolved,
    filter:
      resolved === "original"
        ? "none"
        : resolved === "white"
          ? "brightness(0) invert(1)"
          : DARK_BRAND_LOGO_FILTER,
    color: resolved === "white" ? "#ffffff" : "#343534",
  };
}
