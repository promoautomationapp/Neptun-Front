import { resolvedSavingsMode } from "../settings/savingsPolicy";
import {
  productImageBackgroundContext,
  lightBackground,
} from "./pageBackground";
import type { Campaign, Product } from "../../domain/models";
export const OFFER_STYLES = [
  {
    id: "current",
    name: "Current NEPTUN",
    detail: "Red haPPy price and savings circle",
  },
  {
    id: "card",
    name: "Blue price card",
    detail: "Savings tab above a blue price card",
  },
];

export const SAVING_MODES = [
  { id: "amount", name: "Save €" },
  { id: "percentage", name: "Discount %" },
];

export function offerStyleFor(
  campaign: Partial<Campaign> | null | undefined,
  product?: Partial<Product> | null,
) {
  const saved = product?.offerStyle || campaign?.offerStyle;
  const style =
    saved === "minimal" ? "current" : saved === "compact" ? "card" : saved;
  if (
    !product?.offerStyle &&
    (!style || style === "current") &&
    campaign &&
    Array.isArray(campaign.products) &&
    product
  ) {
    const context = productImageBackgroundContext(
      campaign as Campaign,
      product as Product,
    );
    const light =
      context.kind === "gradient"
        ? lightBackground(context.gradient.from) &&
          lightBackground(context.gradient.to)
        : lightBackground(context.color);
    if (light) return "card";
  }
  return OFFER_STYLES.some((option) => option.id === style) ? style : "current";
}

export function savingModeFor(
  campaign: Partial<Campaign> | null | undefined,
  product?: Partial<Product> | null,
) {
  return resolvedSavingsMode(campaign, product);
}
