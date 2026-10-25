import blueFooterSvg from "./native-neptun-wordmark.svg?raw";
import { logoForBackground } from "../settings/logo-rules";
import type { Campaign } from "../../domain/models";
import { resolveAsset } from "../../api/client";
import "./neptun-wordmark.css";

export function NeptunWordmark({
  dark = false,
  campaign = {},
  backgroundColor,
  color,
}: {
  dark?: boolean;
  campaign?: Partial<Campaign>;
  backgroundColor?: string;
  color?: string;
}) {
  const custom = campaign.brandAssets?.neptun;
  const framed = campaign.neptunLogoOption === "framed";
  const fallback =
    custom ||
    (framed
      ? "/api/assets/legacy/assets/neptun-logo-framed.png"
      : "/api/assets/app/logo");
  const source = logoForBackground(
    campaign,
    "pages",
    backgroundColor ||
      campaign.productBackgroundColor ||
      (dark ? "#1c4075" : "#ffffff"),
    fallback,
    !dark,
  );
  // Recolor the native wordmark paths while preserving its orange underline.
  const renderedSource =
    source === "/brochure-presets/october/neptun-footer.svg" &&
    color &&
    /^#[\da-f]{6}$/i.test(color)
      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(blueFooterSvg.replaceAll("#003d78", color))}`
      : source;
  // Keep the original wordmark treatment for the original artwork. Selected
  // artwork retains its colors and does not receive the decorative red line.
  const treatment =
    source !== fallback || custom || framed
      ? "artwork"
      : dark
        ? "dark"
        : "light";
  return (
    <span className={`neptun-wordmark ${treatment}`}>
      <img src={resolveAsset(renderedSource)} alt="NEPTUN" />
    </span>
  );
}
