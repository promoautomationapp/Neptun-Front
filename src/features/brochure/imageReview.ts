import type {Product,JsonValue}from '../../domain/models';
import { screenAnnotationType, isTelevision, otherScreenInches, tvScreenInches } from "./tvSpecs";
import { IMAGE_PREPARATION_REVISION, imageBackgroundSignature, normalizeImageBackgroundContext } from "./imagePreparationContext";

export { IMAGE_PREPARATION_REVISION, imageBackgroundSignature, normalizeImageBackgroundContext } from "./imagePreparationContext";

export function imagePreparationSource(product: Product) {
  return product.aiOriginalImage || product.image || "";
}

export function buildImagePreparationRequest(product: Product, { backgroundContext, orientation, retry = false, image }: {backgroundContext?:unknown;orientation?:string;retry?:boolean;image?:string} = {}) {
  const picturedProduct = product.bundleProducts?.[0] || product;
  return {
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
  };
}

export function tvInchesEmbedded(product: Product) {
  const inches = tvScreenInches(product);
  return Boolean(inches && product.aiInchesEmbedded &&
    (product.aiPreparationRevision ?? 0) >= IMAGE_PREPARATION_REVISION &&
    product.aiAnnotationStyle === "tv-folded-ribbon" &&
    Number(product.aiPreparedScreenInches) === inches);
}

export function needsImagePreparation(product: Product, backgroundContext?:unknown, { force = false } = {}) {
  if (!product.image || product.skipAiCutout) return false;
  if (force) return true;
  const contextProvided = backgroundContext && typeof backgroundContext === "object";
  const signature = contextProvided ? imageBackgroundSignature(backgroundContext) : "";
  if (product.aiOriginalImage) {
    // Reference documents already contain approved cutouts, but older versions did
    // not record preparation metadata. Keep them until an explicit regeneration.
    if(product.aiPreparationRevision==null && !product.aiBackgroundSignature)return false;
    const annotationChanged = Boolean(product.aiInchesEmbedded) ||
      isTelevision(product) && tvScreenInches(product) && product.aiAnnotationStyle !== "external-tv-corner";
    return Boolean(annotationChanged || contextProvided && (
      (product.aiPreparationRevision ?? 0) < IMAGE_PREPARATION_REVISION ||
      product.aiPreparationRevision == null || product.aiBackgroundSignature !== signature));
  }
  if (product.aiReviewedImageSource !== product.image) return true;
  return Boolean(contextProvided && (product.aiReviewedPreparationRevision !== IMAGE_PREPARATION_REVISION ||
    product.aiReviewedBackgroundSignature !== signature));
}
