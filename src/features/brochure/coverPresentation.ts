import { hasPageAppearance, resolvedPageAppearance } from "./pageAppearance";
import { lightBackground, pageBackgroundContrastColor } from "./pageBackground";
import type { Campaign } from "../../domain/models";
import { coverProducts } from "./campaignPages";
import { isOctoberBrochure } from "./octoberDesign";

export const COVER_TEXT_COLORS = [
  ["coverMessageColor", "Message color"],
  ["coverHeadlineColor", "Title color"],
  ["coverTypeColor", "Campaign type color"],
  ["coverFooterColor", "Footer text color"],
] as const;
export function coverTextColor(
  campaign: Partial<Campaign>,
  field: (typeof COVER_TEXT_COLORS)[number][0],
) {
  if (hasPageAppearance(campaign, "cover")) return resolvedPageAppearance(campaign, "cover").textColor;
  const value = campaign[field];
  if (
    /^#[0-9a-f]{6}$/i.test(value || "") &&
    (campaign.coverTextColorOverrides?.[field] ||
      value?.toLowerCase() !== "#ffffff")
  )
    return value;
  return field !== "coverFooterColor" &&
    lightBackground(pageBackgroundContrastColor(campaign, "cover"))
    ? "#1c4075"
    : "#ffffff";
}
export function coverMessageVisible(campaign: Partial<Campaign>) {
  return (
    campaign.showCoverMessage === true ||
    (campaign.showCoverMessage !== false && Boolean(campaign.tagline?.trim()))
  );
}
export function resetCoverProductPositions(campaign: Campaign) {
  for (const key of Object.keys(campaign.coverElementPlacements || {}))
    if (key.startsWith("product-"))
      delete campaign.coverElementPlacements![key];
}
export function featureCoverProduct(campaign: Campaign, code: string) {
  if (
    code &&
    !coverProducts(campaign).some(
      (product) => String(product.code) === String(code),
    )
  )
    return;
  campaign.coverBannerProductCode = code;
  if (code) campaign.showCoverBand = false;
  resetCoverProductPositions(campaign);
}
export function makeCoverImageLayer(campaign: Campaign, id: string) {
  const image = campaign.coverImage || campaign.coverBackgroundImage;
  if (!image) return false;
  campaign.pageArtworks ||= {};
  campaign.pageArtworks.cover ||= [];
  campaign.pageArtworks.cover.push({
    id,
    type: "image",
    name: "Cover photo",
    image,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    imageFit: "cover",
    opacity: 1,
    zIndex: 1,
  });
  campaign.coverImage = "";
  campaign.coverBackgroundImage = "";
  campaign.coverTemplate = "blueClean";
  return true;
}

export function isFeaturedCoverProduct(
  campaign: Campaign,
  code: string | number,
  index: number,
  count: number,
) {
  if (campaign.showCoverBand === true || isOctoberBrochure(campaign))
    return false;
  return campaign.coverBannerProductCode
    ? String(code) === String(campaign.coverBannerProductCode)
    : count > 0 &&
        index === 0 &&
        resolvedCoverProductLayout(campaign, count) === "hero";
}

export function usesAutomaticCollectionCoverLayout(campaign: Campaign) {
  return (
    ["neptun-current", "neptun-gradient-all"].includes(
      campaign.brochurePresetId || "",
    ) &&
    campaign.showCoverBand !== true &&
    !isOctoberBrochure(campaign) &&
    campaign.coverProductLayoutManual !== true &&
    campaign.coverProductLayout !== "row"
  );
}

export function resolvedCoverProductLayout(campaign: Campaign, _count: number) {
  // These collection designs always start with one offer above the rest.
  // Older snapshots copied the former pair default without an explicit choice.
  if (usesAutomaticCollectionCoverLayout(campaign)) return "hero";
  return (
    campaign.coverProductLayout ||
    (campaign.showCoverBand === true || isOctoberBrochure(campaign)
      ? "pair"
      : "hero")
  );
}
