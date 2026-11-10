import type { Campaign, Product } from "../../domain/models";
import { brandLogoFor } from "./brandLogos";
import { isBlackFridayBrochure } from "./blackFridayDesign";
import { isAppleProduct } from "./productTypes";

export function bundleBrandArtworks(campaign: Campaign, product: Product) {
  const pageAppleBrand = isBlackFridayBrochure(campaign) && product.hideBrandLogo !== false;
  if (pageAppleBrand && isAppleProduct(product)) return [];
  const composite =
    product.brandLogo ||
    (String(product.brand || "").includes(" / ")
      ? brandLogoFor(campaign, product.brand)
      : "");
  if (composite)
    return [{ name: product.brand || "NEPTUN", source: composite }];

  const members = product.bundleProducts || [];
  const candidates = members.some((member) => member.brand)
    ? members.map((member) => ({
        name: String(member.brand || "").trim(),
        source: member.brandLogo || brandLogoFor(campaign, member.brand),
      }))
    : String(product.brand || "NEPTUN")
        .split(/\s+\/\s+/)
        .map((name) => ({ name, source: brandLogoFor(campaign, name) }));
  const unique = new Map<string, { name: string; source: string }>();
  for (const item of candidates) {
    const key = item.name.trim().toUpperCase();
    if (pageAppleBrand && key === "APPLE") continue;
    if (key && !unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()];
}

export function BundleBrandArtwork({
  campaign,
  product,
}: {
  campaign: Campaign;
  product: Product;
}) {
  return bundleBrandArtworks(campaign, product).map(({ name, source }) => (
    <span className="large-bundle-brand-logo" key={name.toUpperCase()}>
      {source ? (
        <img src={source} alt={name} loading="eager" draggable={false} />
      ) : (
        <span className="large-bundle-brand-name">{name}</span>
      )}
    </span>
  ));
}
