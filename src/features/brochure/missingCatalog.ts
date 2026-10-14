import type { Campaign, Product } from "../../domain/models";

/** Excel-only items stay separate from the synchronized catalog, but remain
 * searchable in its UI with their missing-catalog label. */
export function catalogWithExcelProducts(
  catalog: readonly Product[],
  campaigns: readonly Campaign[],
): Product[] {
  const byCode = new Map(catalog.map((product) => [product.code, product]));
  const newestFirst = [...campaigns].sort((a, b) =>
    (b.updatedAt || "").localeCompare(a.updatedAt || ""),
  );
  for (const campaign of newestFirst)
    for (const offer of campaign.products) {
      for (const product of offer.bundleProducts?.length
        ? offer.bundleProducts
        : [offer]) {
        if (product.catalogMissing && !byCode.has(product.code))
          byCode.set(product.code, product);
      }
    }
  return [...byCode.values()];
}

export function campaignContainingExcelProduct(
  campaigns: readonly Campaign[],
  code: string,
): { campaign: Campaign; offer: Product } | undefined {
  for (const campaign of [...campaigns].sort((a, b) =>
    (b.updatedAt || "").localeCompare(a.updatedAt || ""),
  )) {
    const offer = campaign.products.find(
      (product) =>
        product.code === code ||
        product.bundleProducts?.some((member) => member.code === code),
    );
    if (offer) return { campaign, offer };
  }
  return undefined;
}

export function hasRegularPrice(product: Pick<Product, "regular">): boolean {
  return (
    Number.isFinite(Number(product.regular)) && Number(product.regular) > 0
  );
}

export function hasExcelOfferPrice(product: Partial<Product>): boolean {
  return (
    (product.catalogMissing === true || product.source === "import") &&
    Number.isFinite(Number(product.sale)) &&
    Number(product.sale) > 0 &&
    (!hasRegularPrice(product) ||
      Number(product.sale) === Number(product.regular))
  );
}
