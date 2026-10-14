import type {Product,JsonValue}from '../../domain/models';
import { screenAnnotationType, otherScreenInches, tvScreenInches } from "./tvSpecs";
import { IMAGE_PREPARATION_REVISION, normalizeImageBackgroundContext } from "./imagePreparationContext";

export { IMAGE_PREPARATION_REVISION, imageBackgroundSignature, normalizeImageBackgroundContext } from "./imagePreparationContext";

export function imagePreparationSource(product: Product) {
  return product.aiOriginalImage || product.image || "";
}

export function buildImagePreparationRequest(product: Product, { backgroundContext, orientation, retry = false, image }: {backgroundContext?:unknown;orientation?:string;retry?:boolean;image?:string} = {}) {
  const picturedProduct = product.bundleProducts?.[0] || product;
  return {
    provider: "openai" as const,
    image: image || imagePreparationSource(product),
    name: picturedProduct.name,
    brand: picturedProduct.brand ?? "",
    category: picturedProduct.subcategory || picturedProduct.category || "",
    description: picturedProduct.description ?? "",
    screenType: screenAnnotationType(picturedProduct),
    screenInches: tvScreenInches(picturedProduct) || otherScreenInches(picturedProduct),
    backgroundContext: normalizeImageBackgroundContext(backgroundContext),
    ...(orientation ? { orientation } : {}),
    ...(retry ? { retry: true } : {}),
  };
}

export function imagePreparationMetadata(result:Record<string,JsonValue>) {
  const ribbon = result.annotationStyle === "tv-folded-ribbon" && result.screenType === "television" && Number.isFinite(Number(result.screenInches));
  return {
    aiPreparationRevision: Number(result.preparationRevision) || 0,
    aiAnnotationStyle: String(result.annotationStyle || "none"),
    aiInchesEmbedded: Boolean(ribbon && result.inchesEmbedded),
    aiPreparedScreenInches: ribbon ? Number(result.screenInches) : null,
    aiBackgroundSignature: String(result.backgroundSignature || ""),
    aiCutoutProvider: String(result.provider || "openai"),
    aiAnnotationCleanup: result.annotationCleanup === true,
  };
}

export function tvInchesEmbedded(product: Product) {
  const inches = tvScreenInches(product);
  return Boolean(inches && product.aiInchesEmbedded &&
    (product.aiPreparationRevision ?? 0) >= IMAGE_PREPARATION_REVISION &&
    product.aiAnnotationStyle === "tv-folded-ribbon" &&
    Number(product.aiPreparedScreenInches) === inches);
}

export function needsImagePreparation(product: Product, _backgroundContext?:unknown, { force = false } = {}) {
  if (!product.image || product.skipAiCutout) return false;
  if (force) return true;
  // A prepared or approved source remains reusable across backgrounds and
  // display revisions. Only a new photo or an explicit re-cut needs AI.
  if (product.aiOriginalImage) return false;
  return product.aiReviewedImageSource !== product.image;
}
