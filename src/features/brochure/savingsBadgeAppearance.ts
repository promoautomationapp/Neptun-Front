import type { Campaign, Product } from "../../domain/models";
import { usesBlueReferencePrice } from "./priceDesign";

const hex = (value?: string) =>
  /^#[0-9a-f]{6}$/i.test(value || "") ? value : undefined;

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
        textColor: hex(campaign.pricePalette?.saving) || "#ef4023",
      };
}
