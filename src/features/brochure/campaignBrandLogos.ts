import type { Campaign, Product } from "../../domain/models";
import { normalizeBrandLogoName } from "./brandLogos";

/** Includes set members, which can carry an independent manufacturer logo. */
export function campaignBrandLogoProducts(
  campaign: Pick<Campaign, "products">,
): Product[] {
  const result: Product[] = [];
  const visited = new Set<Product>();
  const visit = (product: Product) => {
    if (visited.has(product)) return;
    visited.add(product);
    result.push(product);
    product.bundleProducts?.forEach(visit);
  };
  campaign.products?.forEach(visit);
  return result;
}

/** Applies an explicit brochure-wide choice over imported per-product SVGs.
 * Other manufacturers, colors, placements and logo visibility stay unchanged. */
export function applyBrandLogoToMatchingProducts(
  campaign: Campaign,
  brand: unknown,
  source: string,
) {
  const key = normalizeBrandLogoName(brand);
  if (!key) return 0;
  campaign.brandLogos ||= {};
  for (const saved of Object.keys(campaign.brandLogos))
    if (saved !== key && normalizeBrandLogoName(saved) === key)
      delete campaign.brandLogos[saved];
  campaign.brandLogos[key] = source;
  let updated = 0;
  for (const product of campaignBrandLogoProducts(campaign)) {
    const matches = normalizeBrandLogoName(product.brand) === key;
    if (matches) {
      product.brandLogo = source;
      updated++;
    }
    for (const variant of product.brochureVariants || []) {
      const variantBrand =
        typeof variant.brand === "string" ? variant.brand : product.brand;
      if (normalizeBrandLogoName(variantBrand) === key)
        variant.brandLogo = source;
    }
  }
  return updated;
}
