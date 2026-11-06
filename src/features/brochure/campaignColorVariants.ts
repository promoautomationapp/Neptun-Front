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

/** Old imports sometimes represented interchangeable finishes as simultaneous
 * bundle members. A single-model group is recoverable only when the source
 * slot and shared one-item price agree; a true multi-unit bundle stays intact. */
function legacyColorChoice(product: Product): Product {
  const members = product.bundleProducts;
  if (
    !members ||
    members.length < 2 ||
    !Number.isInteger(product.brochurePage) ||
    !Number.isInteger(product.brochureOrder) ||
    !(Number(product.regular) > 0) ||
    !(Number(product.sale) > 0) ||
    members.some(
      (member) =>
        member.bundleProducts?.length ||
        !variantColor(member) ||
        (Number(member.regular) > 0 &&
          Number(member.regular) !== Number(product.regular)) ||
        (Number(member.sale) > 0 &&
          Number(member.sale) !== Number(product.sale)),
    )
  )
    return product;
  const choices = collapseImportedColorVariants(
    members.map((member) => ({
      product: member,
      color: variantColor(member),
      regular: Number(member.regular) > 0 ? member.regular : product.regular,
      sale: Number(product.sale),
    })),
  );
  if (
    choices.length !== 1 ||
    (choices[0]!.product.brochureVariants?.length || 0) < 2
  )
    return product;
  const primary = choices[0]!.product;
  const result: Product = {
    ...product,
    ...primary,
    category: primary.category,
    subcategory: primary.subcategory,
    categoryPath: primary.categoryPath,
    regular: product.regular,
    sale: product.sale,
    brochurePage: product.brochurePage,
    brochureOrder: product.brochureOrder,
  };
  delete result.bundleProducts;
  delete result.bundleCodes;
  delete result.bundleMemberDetails;
  delete result.setSourceRows;
  // Keep editable extra artwork, but remove the generated duplicate photos.
  const artworks = [
    ...(primary.productArtworks || []),
    ...(product.productArtworks || []).filter(
      (item) => item.type !== "bundle-product" && !item.memberCode,
    ),
  ];
  if (artworks.length) result.productArtworks = artworks;
  else delete result.productArtworks;
  if (!primary.brochureDetails) delete result.brochureDetails;
  if (!primary.brochureCode) delete result.brochureCode;
  if (!primary.brandLogo) delete result.brandLogo;
  return result;
}

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
    const product = displayColorChoice(legacyColorChoice(source));
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
  for (const product of source) {
    if (!product.bundleProducts?.length) continue;
    const first = product.bundleProducts[0]!;
    const parent = products.find(
      (candidate) =>
        String(candidate.code) === String(first.code) &&
        product.bundleProducts!.every((member) =>
          candidate.brochureVariants?.some(
            (variant) => String(variant.code) === String(member.code),
          ),
        ),
    );
    if (parent) aliases.set(String(product.code), String(parent.code));
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
