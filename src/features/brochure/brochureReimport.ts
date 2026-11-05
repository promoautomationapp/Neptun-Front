import type { Product } from "../../domain/models";
import { importCode } from "./productBundles";
import { retainPreparedProductPhoto } from "./productImagePreparationQueue";

const importFields = [
  "bundleProducts",
  "bundleCodes",
  "brochureVariants",
  "setSourceRows",
  "brochureCode",
  "brochureDetails",
  "brochurePage",
  "brochureOrder",
  "excelSource",
  "catalogMissing",
  "missingCatalogCodes",
  "confirmedAboveRegular",
] as const;

function leafProducts(product: Product): Product[] {
  return product.bundleProducts?.length
    ? product.bundleProducts.flatMap(leafProducts)
    : [product];
}

function leafCodes(product: Product): string[] {
  return product.bundleProducts?.length
    ? product.bundleProducts.flatMap(leafCodes)
    : [
        ...new Set(
          [
            ...(product.bundleCodes?.length
              ? product.bundleCodes
              : [product.code]),
            ...(product.brochureVariants || []).flatMap((variant) =>
              variant.code ? [variant.code] : [],
            ),
          ].map(importCode),
        ),
      ];
}

function sameOfferStructure(previous: Product, incoming: Product) {
  // Color choices share the representative photo; adding a choice does not
  // invalidate that prepared image. Only simultaneous product members matter.
  const representativeCodes = (product: Product): string[] =>
    product.bundleProducts?.length
      ? product.bundleProducts.flatMap(representativeCodes)
      : [importCode(product.code)];
  const previousCodes = representativeCodes(previous).sort();
  const incomingCodes = representativeCodes(incoming).sort();
  return (
    Boolean(previous.bundleProducts?.length) ===
      Boolean(incoming.bundleProducts?.length) &&
    previousCodes.length === incomingCodes.length &&
    previousCodes.every((code, index) => code === incomingCodes[index])
  );
}

/** The selected sheet replaces earlier imports while manual campaign additions remain. */
export function mergeBrochureImportProducts(
  previous: readonly Product[],
  incoming: readonly Product[],
  replaceImported = true,
): Product[] {
  const previousOffers = new Map(
    previous.map((product) => [importCode(product.code), product]),
  );
  const previousLeaves = new Map(
    previous
      .flatMap(leafProducts)
      .map((product) => [importCode(product.code), product]),
  );
  const mergeOffer = (product: Product): Product => {
    const key = importCode(product.code);
    const priorOffer = previousOffers.get(key);
    // A synthetic set photo belongs to the whole set. Reuse only a matching
    // offer or actual member when the spreadsheet changes its composition.
    const candidate =
      priorOffer && sameOfferStructure(priorOffer, product)
        ? priorOffer
        : previousLeaves.get(key);
    const prior =
      candidate && sameOfferStructure(candidate, product)
        ? candidate
        : undefined;
    const retained = { ...prior };
    for (const field of importFields) delete retained[field];
    const refreshed = product.bundleProducts?.length
      ? { ...product, bundleProducts: product.bundleProducts.map(mergeOffer) }
      : product;
    return {
      ...retained,
      ...retainPreparedProductPhoto(
        // Members were refreshed above; the photo helper must not merge their
        // obsolete import fields back into the new spreadsheet structure.
        prior?.bundleProducts?.length
          ? { ...prior, bundleProducts: undefined }
          : prior,
        refreshed,
      ),
    };
  };
  const importedCodes = new Set(
    incoming.map((product) => importCode(product.code)),
  );
  const importedLeaves = new Set(incoming.flatMap(leafCodes));
  const lastPage = Math.max(
    1,
    ...incoming.map((product) => product.brochurePage || 1),
  );
  const remaining = previous.filter((product) => {
    if (importedCodes.has(importCode(product.code))) return false;
    const imported = Boolean(
      product.source === "import" ||
      product.excelSource ||
      product.setSourceRows?.length,
    );
    if (!imported) return true;
    if (replaceImported) return false;
    const codes = leafCodes(product);
    return !(
      codes.length > 0 && codes.every((code) => importedLeaves.has(code))
    );
  });
  return [
    ...incoming.map(mergeOffer),
    ...remaining.map((product) =>
      Number.isInteger(product.brochurePage)
        ? product
        : { ...product, brochurePage: lastPage + 1 },
    ),
  ];
}
