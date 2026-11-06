import type { Campaign, Product } from "../../domain/models";
import {
  collapseImportedColorVariants,
  displayVariantName,
  productImportColor,
} from "./importedColorVariants";

const variantColor = (product: Product) =>
  productImportColor(product) ||
  product.brochureVariants?.find((variant) => variant.color)?.color ||
  null;

function displayColorChoice(product: Product): Product {
  if (
    product.bundleProducts?.length ||
    (product.brochureVariants?.length || 0) < 2
  )
    return product;
  const name = displayVariantName(product.name, variantColor(product));
  return name === product.name ? product : { ...product, name };
}

/** Legacy snapshots bypassed import-time grouping. Display the same strict
 * color choices in every design without changing a stored campaign on load. */
export function brochureColorVariantProducts(
  products: readonly Product[],
): Product[] {
  const result: Product[] = [];
  const slots = new Map<string, number[]>();
  for (const source of products) {
    const product = displayColorChoice(source);
    const positioned =
      Number.isInteger(product.brochurePage) &&
      Number(product.brochurePage) >= 1 &&
      Number.isInteger(product.brochureOrder) &&
      Number(product.brochureOrder) >= 0;
    const color = variantColor(product);
    const slot =
      positioned && color && !product.bundleProducts?.length
        ? `${product.brochurePage}:${product.brochureOrder}`
        : null;
    let merged = false;
    if (slot) {
      for (const index of slots.get(slot) || []) {
        const parent = result[index]!;
        const choices = collapseImportedColorVariants([
          { product: parent, color: variantColor(parent) },
          { product, color },
        ]);
        if (choices.length === 1) {
          result[index] = choices[0]!.product;
          merged = true;
          break;
        }
      }
    }
    if (merged) continue;
    if (slot) slots.set(slot, [...(slots.get(slot) || []), result.length]);
    result.push(product);
  }
  return result;
}

/** Map saved cover/featured choices to the first SKU of a color-choice offer. */
export function brochureColorVariantCampaign(campaign: Campaign): Campaign {
  const source = campaign.products || [];
  const products = brochureColorVariantProducts(source);
  if (
    products.length === source.length &&
    products.every((product, index) => product === source[index])
  )
    return campaign;
  const aliases = new Map<string, string>();
  for (const product of products) {
    aliases.set(String(product.code), String(product.code));
    for (const variant of product.brochureVariants || [])
      aliases.set(String(variant.code), String(product.code));
  }
  const code = (value: string) => aliases.get(String(value)) || value;
  return {
    ...campaign,
    products,
    ...(campaign.coverProductCodes
      ? {
          coverProductCodes: [...new Set(campaign.coverProductCodes.map(code))],
        }
      : {}),
    ...(campaign.coverBannerProductCode
      ? { coverBannerProductCode: code(campaign.coverBannerProductCode) }
      : {}),
  };
}

/** An explicit edit makes the displayed offer concrete before its first-SKU
 * name/price/image changes, so raw variant rows cannot reappear afterward. */
export function materializeCampaignColorVariants(campaign: Campaign): boolean {
  const next = brochureColorVariantCampaign(campaign);
  if (next === campaign) return false;
  campaign.products = next.products;
  if (next.coverProductCodes)
    campaign.coverProductCodes = next.coverProductCodes;
  if (next.coverBannerProductCode)
    campaign.coverBannerProductCode = next.coverBannerProductCode;
  return true;
}
