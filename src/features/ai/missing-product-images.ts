import type { Campaign, Product } from "../../domain/models";
import { detailPlainText } from "../brochure/detailFacts";
import { screenArtworkForPhotoChange } from "../brochure/screenGeometry";
import { requestAi } from "./ai.api";
import type { ProductImageSearchResult } from "./ai.api";

export interface MissingImageTarget {
  offerCode: string;
  memberCode?: string;
  requestId: string;
  requestKey: string;
  expectedImage: string;
  params: {
    code: string;
    name: string;
    brand: string;
    category: string;
    details: string[];
  };
}

function imageSource(product: Product): string {
  return product.image || product.localImage || product.imageUrl || "";
}

export function productImageSearchParams(product: Product) {
  const details = [
    ...(product.brochureDetails || []).map((row) =>
      typeof row === "string" ? row : row.text,
    ),
    ...Object.entries(product.specs || {}).map(
      ([key, value]) => `${key}: ${value}`,
    ),
    product.description || "",
  ]
    .map(detailPlainText)
    .filter(Boolean);
  return {
    code: (product.missingCatalogCodes?.length === 1
      ? product.missingCatalogCodes[0]!
      : product.code
    )
      .trim()
      .slice(0, 160),
    name: detailPlainText(product.name).slice(0, 600),
    brand: detailPlainText(product.brand).slice(0, 100),
    category: detailPlainText(product.category).slice(0, 100),
    details: [...new Set(details)]
      .slice(0, 30)
      .map((value) => value.slice(0, 600)),
  };
}

export function productImageSearchKey(product: Product): string {
  // Prices, positions and colors of the page cannot change product identity.
  return JSON.stringify(productImageSearchParams(product));
}

export function missingImageTargets(
  products: readonly Product[],
  manual = false,
): MissingImageTarget[] {
  return products.flatMap((offer) => {
    const members = offer.bundleProducts?.length
      ? offer.bundleProducts
      : [offer];
    return members
      .filter(
        (member) => member.catalogMissing && (manual || !imageSource(member)),
      )
      .map((member) => ({
        offerCode: offer.code,
        ...(member !== offer ? { memberCode: member.code } : {}),
        requestId: crypto.randomUUID(),
        requestKey: productImageSearchKey(member),
        expectedImage: imageSource(member),
        params: productImageSearchParams(member),
      }));
  });
}

function findTarget(campaign: Campaign, target: MissingImageTarget) {
  const offer = campaign.products.find(
    (product) => product.code === target.offerCode,
  );
  const product = target.memberCode
    ? offer?.bundleProducts?.find((member) => member.code === target.memberCode)
    : offer;
  return { offer, product };
}

export function startMissingImageSearch(
  campaign: Campaign,
  target: MissingImageTarget,
): boolean {
  const { product } = findTarget(campaign, target);
  if (
    !product ||
    productImageSearchKey(product) !== target.requestKey ||
    imageSource(product) !== target.expectedImage
  )
    return false;
  product.imageSearch = {
    status: "searching",
    requestKey: target.requestKey,
    requestId: target.requestId,
  };
  return true;
}

/** Mutates only a still-pending target. Undo, removal, a new search, a manual
 * upload or edited identifying facts invalidate the asynchronous result. */
export function finishMissingImageSearch(
  campaign: Campaign,
  target: MissingImageTarget,
  result: ProductImageSearchResult | Error,
): boolean {
  const { offer, product } = findTarget(campaign, target);
  if (
    !product ||
    product.imageSearch?.status !== "searching" ||
    product.imageSearch.requestId !== target.requestId
  )
    return false;
  if (
    productImageSearchKey(product) !== target.requestKey ||
    imageSource(product) !== target.expectedImage
  ) {
    // A user edit cancels only this request's status, so Find stays usable.
    delete product.imageSearch;
    return false;
  }
  const common = { requestKey: target.requestKey, requestId: target.requestId };
  if (result instanceof Error) {
    product.imageSearch = {
      ...common,
      status: "failed",
      message: result.message.slice(0, 300),
    };
  } else if (!result.found) {
    product.imageSearch = {
      ...common,
      status: "not_found",
      message: result.reason,
    };
  } else {
    product.imageSearch = {
      ...common,
      status: "found",
      sourceUrl: result.sourceUrl,
      imageUrl: result.imageUrl,
      matchedName: result.matchedName,
    };
    product.screenArtwork = screenArtworkForPhotoChange(
      product.screenArtwork,
      product.image,
      result.image,
    );
    product.image = result.image;
    product.skipAiCutout = true;
    for (const key of [
      "aiOriginalImage",
      "aiInchesEmbedded",
      "aiPreparationRevision",
      "aiPreparedScreenInches",
      "aiAnnotationStyle",
      "aiBackgroundSignature",
      "aiReviewedImageSource",
      "aiReviewedPreparationRevision",
      "aiReviewedBackgroundSignature",
    ] as const)
      delete product[key];
    if (offer && target.memberCode) {
      offer.productArtworks = offer.productArtworks?.map((artwork) =>
        artwork.type === "bundle-product" &&
        artwork.memberCode === target.memberCode &&
        !artwork.usesPrimaryImage
          ? { ...artwork, image: result.image }
          : artwork,
      );
    }
    if (
      offer &&
      target.memberCode &&
      offer.bundleProducts?.[0] === product &&
      (!imageSource(offer) || imageSource(offer) === target.expectedImage)
    )
      offer.image = result.image;
  }
  return true;
}

// Invoked only after an explicit import or Find image command. Opening editors,
// reloading campaigns and downloading brochures never issue provider commands.
export async function findMissingProductImages(
  targets: readonly MissingImageTarget[],
  apply: (
    target: MissingImageTarget,
    result: ProductImageSearchResult | Error,
  ) => void,
  retry = false,
): Promise<void> {
  const queue = [...targets];
  await Promise.all(
    Array.from({ length: Math.min(2, queue.length) }, async () => {
      let target: MissingImageTarget | undefined;
      while ((target = queue.shift())) {
        try {
          const result = await requestAi("ai-find-product-image", {
            ...target.params,
            ...(retry ? { retry: true } : {}),
          });
          apply(target, result);
        } catch (error) {
          apply(
            target,
            error instanceof Error ? error : new Error("Image search failed."),
          );
        }
      }
    }),
  );
}
