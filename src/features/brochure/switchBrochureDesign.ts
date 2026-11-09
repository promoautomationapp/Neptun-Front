import type { BrochurePresetDefinition, Campaign } from "../../domain/models";
import { applyBrochurePreset } from "./brochurePresets";
import { materializeCampaignColorVariants } from "./campaignColorVariants";
import { repairAutomaticCollectionCoverLayout } from "./coverElements";

const backgroundKeys = [
  "coverBackgroundColor",
  "coverBackgroundGradient",
  "coverBackgroundImage",
  "coverImage",
  "productBackgroundColor",
  "productBackgroundGradient",
  "productBackgroundImage",
  "storesBackgroundColor",
  "storesBackgroundGradient",
  "storesBackgroundImage",
  "coverOverlayGradient",
  "coverGradientRegion",
  "brandLogoMode",
  "coverMessageColor",
  "coverHeadlineColor",
  "coverTypeColor",
  "coverFooterColor",
  "coverTextColorOverrides",
] as const;

/** Change presentation without losing staff's positioning, copy or source offers. */
export function switchBrochureDesign(
  campaign: Campaign,
  preset: BrochurePresetDefinition,
) {
  materializeCampaignColorVariants(campaign);
  Object.assign(campaign, repairAutomaticCollectionCoverLayout(campaign));
  const keep = {
    coverElementPlacements: structuredClone(campaign.coverElementPlacements),
    pageArtworks: structuredClone(campaign.pageArtworks),
    storesElementPlacements: structuredClone(campaign.storesElementPlacements),
    storeFooterElementPlacements: structuredClone(
      campaign.storeFooterElementPlacements,
    ),
    storePositions: structuredClone(campaign.storePositions),
    campaignAssets: structuredClone(campaign.campaignAssets),
    brandLogos: structuredClone(campaign.brandLogos),
    storesSnapshot: structuredClone(campaign.storesSnapshot),
    selectedStoreIndexes: structuredClone(campaign.selectedStoreIndexes),
    storeOrder: structuredClone(campaign.storeOrder),
    storeFields: structuredClone(campaign.storeFields),
    contactVisibility: structuredClone(campaign.contactVisibility),
    storesHiddenElements: structuredClone(campaign.storesHiddenElements),
    storeFooterHiddenElements: structuredClone(
      campaign.storeFooterHiddenElements,
    ),
    coverHeadline: campaign.coverHeadline,
    tagline: campaign.tagline,
    coverBrandTagline: campaign.coverBrandTagline,
    paymentText: campaign.paymentText,
    // Page content and deliberate local layouts remain. Background overrides
    // are removed below so they cannot obscure the newly selected design.
    pages: structuredClone(campaign.pages),
  };
  const manualCoverLayout = campaign.coverProductLayoutManual;
  const footerContent = Object.fromEntries(
    ["dateText", "bottom", "height", "dateWidth", "dateSize", "paymentSize"]
      .filter(
        (key) =>
          campaign.brochureFooter?.[
            key as keyof NonNullable<Campaign["brochureFooter"]>
          ] !== undefined,
      )
      .map((key) => [
        key,
        campaign.brochureFooter![
          key as keyof NonNullable<Campaign["brochureFooter"]>
        ],
      ]),
  );
  // A partial saved preset must not accidentally retain a photograph or gradient
  // from the previous design. Missing keys now use the chosen design's defaults.
  for (const key of backgroundKeys) delete campaign[key];
  applyBrochurePreset(campaign, preset);
  for (const [key, value] of Object.entries(keep)) {
    if (value === undefined) continue;
    if (key === "coverElementPlacements" || key === "brandLogos") {
      Object.assign(campaign, {
        [key]: Object.assign({}, campaign[key], value),
      });
    } else Object.assign(campaign, { [key]: value });
  }
  if (manualCoverLayout) campaign.coverProductLayoutManual = true;
  if (Object.keys(footerContent).length)
    campaign.brochureFooter = { ...campaign.brochureFooter, ...footerContent };
  for (const page of Object.values(campaign.pages || {})) {
    delete page.backgroundColor;
    delete page.backgroundGradient;
    delete page.backgroundImage;
  }
  if (preset.design.pageAppearances)
    campaign.pageAppearances = structuredClone(preset.design.pageAppearances);
  else delete campaign.pageAppearances;
  campaign.aiBackgroundChanged = false;
}
