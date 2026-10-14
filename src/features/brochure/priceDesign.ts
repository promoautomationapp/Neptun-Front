import type {Campaign,Product}from '../../domain/models';
import { isAppleProduct } from "./productTypes";
import { offerStyleFor } from "./offerStyles";

export { isAppleProduct } from "./productTypes";

export function referencePriceDesignFor(product: Product, campaign: Partial<Campaign> = {}) {
  if (isAppleProduct(product)) return "legacy";
  const style = offerStyleFor(campaign, product);
  return style === "current" ? "red" : style === "card" || style === "compact" ? "blue" : "legacy";
}

export function usesRedReferencePrice(product: Product, campaign: Partial<Campaign> = {}) {
  return referencePriceDesignFor(product, campaign) === "red";
}

export function usesBlueReferencePrice(product: Product, campaign: Partial<Campaign> = {}) {
  return referencePriceDesignFor(product, campaign) === "blue";
}
