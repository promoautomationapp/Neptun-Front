import sourceManifest from "./blackFridaySourceManifest.json";
import type { Product } from "../../domain/models";
import { otherScreenInches, tvScreenInches } from "./tvSpecs";

const sourceOrigin = "https://neptun.promoautomation.app";
const imageRoot = "/brochure-presets/black-friday/images/";
const sourceImages = new Set(sourceManifest.images);
const sourceProducts = new Map(
  sourceManifest.products.map((product) => [product.imageUrl, product]),
);

/** Only the supplied, shipped source assets qualify as already prepared photos. */
export function blackFridaySourceImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (
    !input ||
    input.startsWith("//") ||
    (!input.startsWith("/") && !/^https:\/\//i.test(input))
  )
    return null;
  try {
    const url = new URL(input, sourceOrigin);
    if (
      url.origin !== sourceOrigin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !url.pathname.startsWith(imageRoot) ||
      !sourceImages.has(url.pathname)
    )
      return null;
    return url.pathname;
  } catch {
    return null;
  }
}

/** The original brochure asset is approved source artwork, so reimport never
 * spends AI credits cutting it out or replacing the source's product details. */
export function applyBlackFridaySourceImage(
  product: Product,
  image: unknown,
  { hasDetails = false, hasWarranty = false } = {},
): boolean {
  const localImage = blackFridaySourceImage(image);
  if (!localImage) return false;
  product.image = localImage;
  product.skipAiCutout = true;
  product.aiReviewedImageSource = localImage;
  // A catalog image's prepared metadata must not describe this replacement.
  delete product.aiOriginalImage;
  delete product.aiInchesEmbedded;
  delete product.aiAnnotationStyle;
  delete product.aiPreparedScreenInches;
  delete product.aiPreparationRevision;
  delete product.aiBackgroundSignature;
  delete product.aiCutoutProvider;
  delete product.aiCutoutValidated;
  delete product.aiCutoutValidationVersion;
  delete product.aiCutoutReviewRevision;
  delete product.aiCutoutReviewAccepted;
  delete product.aiReviewedPreparationRevision;
  delete product.aiReviewedBackgroundSignature;
  const source = sourceProducts.get(localImage);
  if (source) {
    product.savingMode =
      source.savingMode === "percentage" ? "percentage" : "amount";
    if (source.sourceSavings && Number(source.sourceSavings.value) > 0)
      product.brochureSavings = {
        value: Number(source.sourceSavings.value),
        type: source.sourceSavings.type === "percent" ? "percentage" : "amount",
        regular: Number(source.regular),
        sale: Number(source.sale),
      };
    if (!product.brand && source.brand) product.brand = source.brand;
    if (source.brandImageUrl) product.brandLogo = source.brandImageUrl;
    if (
      Number(source.screenSize) > 0 &&
      !tvScreenInches(product) &&
      !otherScreenInches(product)
    )
      product.specs = {
        ...product.specs,
        "Screen size": `${source.screenSize}"`,
      };
    if (Number(source.installment) > 0 && Number(source.sale) > 0)
      product.brochureInstallment = {
        amount: Number(source.installment),
        count: 12,
        sale: Number(source.sale),
      };
    if (!hasDetails) product.brochureDetails = [...source.details];
    if (!hasWarranty && source.warranty) product.warranty = source.warranty;
    if (source.colors.length) {
      product.brochureVariants = source.colors.map((color, index) => ({
        ...(index === 0 ? { code: product.code } : {}),
        name: product.name,
        color: { ...color },
      }));
    }
  }
  return true;
}

/** Preview-only offers reproduce the uploaded reference. Campaign creation
 * keeps its ordinary empty product list until an Excel workbook is imported. */
export function blackFridaySampleProducts(): Product[] {
  return sourceManifest.products.map((source) => {
    const product: Product = {
      code: source.code,
      name: source.name,
      brand: source.brand,
      regular: source.regular,
      sale: source.sale,
      brochurePage: source.page,
      brochureOrder: source.order,
      source: "import",
      ...(source.url ? { url: source.url } : {}),
    };
    applyBlackFridaySourceImage(product, source.imageUrl);
    return product;
  });
}
