import type { Campaign, Placement } from "../../domain/models";
import "../../styles/neptun-cover-logo.css";

export type BuiltinCoverLogo = "original" | "framed";

/** Saved built-in aliases become asset UUIDs; retain their explicit style receipt. */
export function builtinCoverLogo(
  campaign: Partial<Campaign>,
  source: string,
): BuiltinCoverLogo | null {
  if (/\/assets\/neptun-cover-logo\.png(?:[?#]|$)/.test(source))
    return "original";
  if (/\/assets\/neptun-logo-framed\.png(?:[?#]|$)/.test(source))
    return "framed";
  if (
    source &&
    source === campaign.coverLogoSource &&
    (!campaign.logoRuleDefaults ||
      campaign.logoRuleDefaults.cover === source) &&
    (campaign.coverLogoStyle === "original" ||
      campaign.coverLogoStyle === "framed")
  )
    return campaign.coverLogoStyle;
  return null;
}

export function neptunCoverTaglinePlacement(
  logo: Placement & { x: number; y: number; width: number },
  variant: BuiltinCoverLogo,
) {
  const ratio = variant === "original" ? 1862 / 478 : 1358 / 350;
  // Covers use the canonical 1080:1350 artwork coordinate system.
  return {
    x: logo.x + logo.width * 0.4,
    y: logo.y + (logo.width / ratio) * 0.8 + 0.7,
    width: logo.width * 0.6,
    height: 1.6,
  };
}

/** Display the unchanged built-in raster's frame only. Its baked tagline is
 * outside this viewport; the cover owns one separate editable italic tagline. */
export function NeptunCoverLogo({
  source,
  variant,
}: {
  source: string;
  variant: BuiltinCoverLogo;
}) {
  return (
    <div
      className={`neptun-cover-logo-frame ${variant}`}
      data-builtin-cover-logo={variant}
    >
      <img src={source} alt="NEPTUN" draggable={false} />
    </div>
  );
}
