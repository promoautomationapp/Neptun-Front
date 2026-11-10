import type { Campaign, Product } from "../../domain/models";
import { isBlackFridayBrochure } from "./blackFridayDesign";
import { usesBlueReferencePrice } from "./priceDesign";

const hex = (value?: string) =>
  /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value || "") ? value : undefined;

export function savingsBadgeColors(product: Product) {
  return {
    backgroundColor: hex(product.savingsBadge?.backgroundColor),
    textColor: hex(product.savingsBadge?.textColor),
  };
}

export function savingsBadgeDefaults(campaign: Campaign, product: Product) {
  return usesBlueReferencePrice(product, campaign)
    ? {
        backgroundColor: hex(campaign.pricePalette?.blue) || "#243a6a",
        textColor: "#ffffff",
      }
    : {
        backgroundColor: "#ffffff",
        textColor:
          hex(campaign.pricePalette?.saving) ||
          (isBlackFridayBrochure(campaign) ? "#000000" : "#ef4023"),
      };
}
