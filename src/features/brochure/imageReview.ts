import type { Product, JsonValue } from "../../domain/models";
import {
  screenAnnotationType,
  otherScreenInches,
  tvScreenInches,
} from "./tvSpecs";
import {
  IMAGE_PREPARATION_REVISION,
  normalizeImageBackgroundContext,
} from "./imagePreparationContext";

export {
  IMAGE_PREPARATION_REVISION,
  imageBackgroundSignature,
  normalizeImageBackgroundContext,
} from "./imagePreparationContext";

export function imagePreparationSource(product: Product) {
  return product.aiOriginalImage || product.image || "";
}

export function discardPreparedProductPhoto(
  product: Product,
): Partial<Product> {
  return {
    image: imagePreparationSource(product),
    aiOriginalImage: "",
    skipAiCutout: false,
    aiInchesEmbedded: undefined,
    aiAnnotationStyle: undefined,
    aiPreparedScreenInches: undefined,
    aiPreparationRevision: undefined,
    aiBackgroundSignature: undefined,
    aiCutoutProvider: undefined,
    aiAnnotationCleanup: undefined,
    aiCutoutValidated: undefined,
    aiCutoutValidationVersion: undefined,
    aiCutoutReviewRevision: undefined,
    aiCutoutReviewAccepted: undefined,
    aiReviewedImageSource: undefined,
    aiReviewedPreparationRevision: undefined,
    aiReviewedBackgroundSignature: undefined,
  };
}

export function buildImagePreparationRequest(
  product: Product,
  {
    backgroundContext,
    orientation,
    retry = false,
    regenerate = false,
    rejectedImage,
    image,
    instructions,
  }: {
    backgroundContext?: unknown;
    orientation?: string;
    retry?: boolean;
    regenerate?: boolean;
    rejectedImage?: string;
    image?: string;
    instructions?: string;
  } = {},
) {
  const picturedProduct = product.bundleProducts?.[0] || product;
  return {
    provider: "openai" as const,
    image: image || imagePreparationSource(product),
    name: picturedProduct.name,
    brand: picturedProduct.brand ?? "",
    category: picturedProduct.subcategory || picturedProduct.category || "",
    description: picturedProduct.description ?? "",
    screenType: screenAnnotationType(picturedProduct),
    screenInches:
      tvScreenInches(picturedProduct) || otherScreenInches(picturedProduct),
    backgroundContext: normalizeImageBackgroundContext(backgroundContext),
    ...(orientation ? { orientation } : {}),
    ...(retry ? { retry: true } : {}),
    ...(regenerate ? { regenerate: true } : {}),
    ...(regenerate &&
    rejectedImage &&
    rejectedImage !== (image || imagePreparationSource(product))
      ? { rejectedImage }
      : {}),
    ...(instructions?.trim()
      ? { instructions: instructions.trim().slice(0, 1000) }
      : {}),
  };
}

export function imagePreparationMetadata(result: Record<string, JsonValue>) {
  if (
    result.cutoutValidated !== true ||
    !(Number(result.cutoutValidationVersion) >= 1)
  )
    throw new Error(
      "The background removal could not be verified. The original photo has been kept. Try again or choose another photo.",
    );
  const ribbon =
    result.annotationStyle === "tv-folded-ribbon" &&
    result.screenType === "television" &&
    Number.isFinite(Number(result.screenInches));
  return {
    aiPreparationRevision: Number(result.preparationRevision) || 0,
    aiAnnotationStyle: String(result.annotationStyle || "none"),
    aiInchesEmbedded: Boolean(ribbon && result.inchesEmbedded),
    aiPreparedScreenInches: ribbon ? Number(result.screenInches) : null,
    aiBackgroundSignature: String(result.backgroundSignature || ""),
    aiCutoutProvider: String(result.provider || "openai"),
    aiAnnotationCleanup: result.annotationCleanup === true,
    aiCutoutValidated: true,
    aiCutoutValidationVersion: Number(result.cutoutValidationVersion),
  };
}

export function tvInchesEmbedded(product: Product) {
  const inches = tvScreenInches(product);
  return Boolean(
    inches &&
    product.aiInchesEmbedded &&
    (product.aiPreparationRevision ?? 0) >= IMAGE_PREPARATION_REVISION &&
    product.aiAnnotationStyle === "tv-folded-ribbon" &&
    Number(product.aiPreparedScreenInches) === inches,
  );
}

export function needsImagePreparation(
  product: Product,
  _backgroundContext?: unknown,
  { force = false } = {},
) {
  if (!product.image) return false;
  if (force) return true;
  if (product.skipAiCutout) return false;
  // A prepared or approved source remains reusable across backgrounds and
  // display revisions. Only a new photo or an explicit re-cut needs AI.
  if (product.aiOriginalImage)
    return (
      product.aiCutoutValidated !== true ||
      (product.aiCutoutValidationVersion ?? 0) < 1
    );
  return product.aiReviewedImageSource !== product.image;
}
