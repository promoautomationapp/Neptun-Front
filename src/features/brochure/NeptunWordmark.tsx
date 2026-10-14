import type { Campaign } from "../../domain/models";
import { resolveAsset } from "../../api/client";
import "./neptun-wordmark.css";

export function NeptunWordmark({
  dark = false,
  campaign = {},
}: {
  dark?: boolean;
  campaign?: Partial<Campaign>;
}) {
  const custom = campaign.brandAssets?.neptun;
  const framed = campaign.neptunLogoOption === "framed";
  const source =
    custom ||
    (framed
      ? "/api/assets/legacy/assets/neptun-logo-framed.png"
      : "/api/assets/app/logo");
  // Keep the original wordmark treatment for the original artwork. Selected
  // artwork retains its colors and does not receive the decorative red line.
  const treatment = custom || framed ? "artwork" : dark ? "dark" : "light";
  return (
    <span className={`neptun-wordmark ${treatment}`}>
      <img src={resolveAsset(source)} alt="NEPTUN" />
    </span>
  );
}
