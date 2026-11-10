import type { Campaign } from "../../domain/models";
/** Both black collections share the same compact stores styling when selected. */
export function usesBlackFridayStoresFooter(campaign: Partial<Campaign>) {
  return (
    ["neptun-black-friday", "neptun-black-collection"].includes(
      campaign.brochurePresetId || "",
    ) ||
    ["black-friday", "black-collection"].includes(
      campaign.brochureReferenceDesign || "",
    )
  );
}

/** An earlier black-design release saved its forced footer as the default.
 * A version receipt distinguishes those drafts from later deliberate choices. */
export function needsStoresDisplayMigration(campaign: Partial<Campaign>) {
  return (
    usesBlackFridayStoresFooter(campaign) &&
    (campaign.storesDisplayVersion ?? 0) < 1 &&
    campaign.includeStoresPage === false &&
    campaign.includeStoresFooter === true
  );
}

export function migrateStoresDisplaySelection(campaign: Campaign) {
  if (!needsStoresDisplayMigration(campaign)) return false;
  campaign.includeStoresPage = true;
  campaign.includeStoresFooter = false;
  campaign.storesDisplayVersion = 1;
  return true;
}

export function includesStoresPage(campaign: Partial<Campaign>) {
  return (
    needsStoresDisplayMigration(campaign) ||
    campaign?.includeStoresPage !== false
  );
}

export function selectedStoreIndexes(
  campaign: Partial<Campaign>,
  storeCount: number,
) {
  const all = Array.from({ length: storeCount }, (_, index) => index);
  if (!Array.isArray(campaign?.selectedStoreIndexes)) return all;
  return all.filter((index) => campaign.selectedStoreIndexes?.includes(index));
}

export function includesOnlineStore(campaign: Partial<Campaign>) {
  return campaign?.showOnlineStore !== false;
}

export function brochurePageCount(
  campaign: Partial<Campaign>,
  productPageCount: number,
) {
  return productPageCount + 1 + Number(includesStoresPage(campaign));
}

export function includesStoresFooter(campaign: Partial<Campaign>) {
  return (
    campaign?.includeStoresFooter === true && !includesStoresPage(campaign)
  );
}

export function compactStoresFooterHeight(campaign: Partial<Campaign>) {
  const value = campaign?.compactStoresFooterHeight;
  const height =
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
      ? NaN
      : Number(value);
  return Number.isFinite(height) ? Math.max(10, Math.min(28, height)) : 18;
}

export function compactStoresFooterScale(campaign: Partial<Campaign>) {
  return (100 - compactStoresFooterHeight(campaign)) / 100;
}

export function hasCompactStoresFooter(
  campaign: Partial<Campaign>,
  pageIndex: number,
  lastProductIndex: number,
) {
  return (
    includesStoresFooter(campaign) &&
    Number.isInteger(pageIndex) &&
    Number.isInteger(lastProductIndex) &&
    pageIndex >= -1 &&
    pageIndex === lastProductIndex
  );
}
