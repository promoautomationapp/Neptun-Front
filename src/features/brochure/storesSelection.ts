import type {Campaign}from '../../domain/models';
export function includesStoresPage(campaign: Partial<Campaign>) {
  return campaign?.includeStoresPage !== false;
}

export function selectedStoreIndexes(campaign: Partial<Campaign>, storeCount:number) {
  const all = Array.from({ length: storeCount }, (_, index) => index);
  if (!Array.isArray(campaign?.selectedStoreIndexes)) return all;
  return all.filter((index) => campaign.selectedStoreIndexes?.includes(index));
}

export function includesOnlineStore(campaign: Partial<Campaign>) {
  return campaign?.showOnlineStore !== false;
}

export function brochurePageCount(campaign: Partial<Campaign>, productPageCount: number) {
  return productPageCount + 1 + Number(includesStoresPage(campaign));
}

export function includesStoresFooter(campaign: Partial<Campaign>) {
  return campaign?.includeStoresFooter === true && !includesStoresPage(campaign);
}

export function compactStoresFooterHeight(campaign: Partial<Campaign>) {
  const value = campaign?.compactStoresFooterHeight;
  const height = value === null || value === undefined || value === "" || typeof value === "boolean" ? NaN : Number(value);
  return Number.isFinite(height) ? Math.max(10, Math.min(28, height)) : 18;
}

export function compactStoresFooterScale(campaign: Partial<Campaign>) {
  return (100 - compactStoresFooterHeight(campaign)) / 100;
}

export function hasCompactStoresFooter(campaign: Partial<Campaign>, pageIndex: number, lastProductIndex: number) {
  return includesStoresFooter(campaign) && Number.isInteger(pageIndex) && Number.isInteger(lastProductIndex) && pageIndex >= -1 && pageIndex === lastProductIndex;
}
