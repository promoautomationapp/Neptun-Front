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
    model?: string;
    ean?: string;
    subcategory?: string;
    sourceUrl?: string;
    variants?: string[];
    bundle?: boolean;
  };
}

function imageSource(product: Product): string {
  return product.image || product.localImage || product.imageUrl || "";
}

export function productImageSearchParams(product: Product) {
  const identity = product as Product & {
    model?: string;
    ean?: string;
    color?: string;
  };
  const identityCells = Object.entries(product.excelSource?.cells || {}).filter(
    ([key]) => {
      const normalized = key.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
      return (
        !/price|cmim|discount|kursen|zbritje/i.test(normalized) &&
        /model|mpn|emertim|name|brand|marka|ngjyr|colou?r|memori|storage|capacity|pershkrim|description|spec|ean|barcode/i.test(
          normalized,
        )
      );
    },
  );
  const model = detailPlainText(
    identity.model ||
      Object.entries(product.specs || {}).find(([key]) =>
        /^(?:model|modeli|mpn)$/i.test(key.trim()),
      )?.[1] ||
      identityCells.find(([key]) => /model|mpn/i.test(key))?.[1] ||
      "",
  ).slice(0, 160);
  const variants = [
    ...new Set(
      [
        identity.color || "",
        ...Object.entries(product.specs || {})
          .filter(([key]) =>
            /^(?:colou?r|ngjyra|selected variant)$/i.test(key.trim()),
          )
          .map(([, value]) => value),
      ]
        .map(detailPlainText)
        .filter(Boolean),
    ),
  ].slice(0, 12);
  const details = [
    ...Object.entries(product.specs || {})
      .filter(([key]) =>
        /model|mpn|colou?r|ngjyr|memori|storage|capacity/i.test(key),
      )
      .map(([key, value]) => `${key}: ${value}`),
    ...identityCells.map(([key, value]) => `${key}: ${value}`),
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
    ...(model ? { model } : {}),
    ...(identity.ean
      ? { ean: detailPlainText(identity.ean).slice(0, 40) }
      : {}),
    ...(product.subcategory
      ? { subcategory: detailPlainText(product.subcategory).slice(0, 160) }
      : {}),
    ...(product.url && /^https:\/\//i.test(product.url)
      ? { sourceUrl: product.url.slice(0, 2048) }
      : {}),
    ...(variants.length ? { variants } : {}),
    ...(product.bundleCodes &&
    product.bundleCodes.length > 1 &&
    !product.bundleProducts?.length
      ? { bundle: true }
      : {}),
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
        (member) =>
          member.catalogMissing &&
          member.name !== member.excelSource?.placeholderName &&
          (manual || !imageSource(member)),
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
    // Finding the exact model only supplies a source photograph. It still needs
    // the same background removal as an uploaded or catalog product photo.
    product.skipAiCutout = false;
    for (const key of [
      "aiOriginalImage",
      "aiInchesEmbedded",
      "aiPreparationRevision",
      "aiPreparedScreenInches",
      "aiAnnotationStyle",
      "aiBackgroundSignature",
      "aiCutoutProvider",
      "aiAnnotationCleanup",
      "aiCutoutReviewRevision",
      "aiCutoutReviewAccepted",
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
  const requests = new Map<string, Promise<ProductImageSearchResult>>();
  await Promise.all(
    Array.from({ length: Math.min(2, queue.length) }, async () => {
      let target: MissingImageTarget | undefined;
      while ((target = queue.shift())) {
        try {
          const { code, name, brand, model, ean, bundle, variants, details } =
            target.params;
          const identity = {
            code,
            name,
            brand,
            model,
            ean,
            bundle,
            variants,
            details,
          };
          const key = JSON.stringify({
            ...identity,
            details: [...identity.details].sort(),
          });
          let pending = requests.get(key);
          if (!pending) {
            pending = requestAi("ai-find-product-image", {
              ...target.params,
              ...(retry ? { retry: true } : {}),
            });
            requests.set(key, pending);
          }
          const result = await pending;
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
