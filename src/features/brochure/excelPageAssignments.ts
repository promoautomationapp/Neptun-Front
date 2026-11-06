import type { Campaign, Product } from "../../domain/models";
import { parseBrochurePosition } from "./brochureImport";
import { materializeCampaignColorVariants } from "./campaignColorVariants";
import { normalizedDetail } from "./detailFacts";

function excelPosition(
  product: Product,
): ReturnType<typeof parseBrochurePosition> {
  const cell = Object.entries(product.excelSource?.cells || {}).find(([key]) =>
    /^(?:brochure\s*position|position|pozicion(?:i)?(?:\s+i\s+broshures)?)$/.test(
      normalizedDetail(key).trim(),
    ),
  );
  return (
    parseBrochurePosition(cell?.[1]) ||
    product.bundleProducts?.map(excelPosition).find(Boolean) ||
    null
  );
}

export function hasExcelPageAssignments(campaign: Campaign) {
  return campaign.products.some((product) => excelPosition(product));
}

/** Explicit and undoable: old automatic splits and deliberate page moves used
 * the same stored fields, so opening a brochure must never silently reset them. */
export function restoreExcelPageAssignments(campaign: Campaign) {
  let restored = false;
  for (const product of campaign.products) {
    const position = excelPosition(product);
    if (!position) continue;
    product.brochurePage = position.page;
    product.brochureOrder = position.order;
    delete product.brochureCardSize;
    restored = true;
  }
  if (!restored) return false;
  campaign.products.sort(
    (a, b) =>
      (a.brochurePage ?? 999) - (b.brochurePage ?? 999) ||
      (a.brochureOrder ?? 999) - (b.brochureOrder ?? 999),
  );
  campaign.autoProductLayout = true;
  for (const page of Object.values(campaign.pages || {})) delete page.layout;
  materializeCampaignColorVariants(campaign);
  campaign.coverProductCodes = campaign.products
    .filter((product) => product.brochurePage === 1)
    .map((product) => product.code);
  return true;
}
