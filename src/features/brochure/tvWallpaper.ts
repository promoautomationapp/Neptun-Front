import type { Campaign, Product, ScreenArtwork } from "../../domain/models";
import { isTelevision } from "./tvSpecs";
import {
  normalizeScreenPhotoSource,
  screenPhotoSource,
} from "./screenGeometry";
import type { TvWallpaperFitPlan } from "./tvWallpaperFit";
import { effectiveProductArtworks } from "./productArtwork";
import { bundleMemberByCode } from "./bundleMemberUpdates";
import { isBundleOffer } from "./productBundles";

type ProductCollection = Pick<Campaign, "products">;

function campaignProducts(products: Product[], result: Product[] = []) {
  for (const product of products || []) {
    result.push(product);
    if (Array.isArray(product.bundleProducts))
      campaignProducts(product.bundleProducts, result);
  }
  return result;
}

export function campaignTelevisions(campaign: ProductCollection) {
  return campaignProducts(campaign?.products).filter(
    (product) => !isBundleOffer(product) && isTelevision(product),
  );
}

function renderedBundlePhotos(campaign: ProductCollection) {
  const sources = new Map<Product, string>();
  for (const product of campaignProducts(campaign.products)) {
    if (!isBundleOffer(product)) continue;
    for (const artwork of effectiveProductArtworks(product)) {
      if (
        artwork.type !== "bundle-product" ||
        !artwork.memberCode ||
        !artwork.image
      )
        continue;
      const member = bundleMemberByCode(product, artwork.memberCode);
      if (member && !sources.has(member)) sources.set(member, artwork.image);
    }
  }
  return sources;
}

function editableScreenProduct(product: Product) {
  return isBundleOffer(product)
    ? campaignProducts(product.bundleProducts || []).find(
        (member) => !isBundleOffer(member) && isTelevision(member),
      ) || product
    : product;
}

// Editor/fitter views use the exact rendered member photo. These copies never
// replace catalog member data or a deliberately replaced primary bundle photo.
export function campaignTelevisionPhoto(
  campaign: ProductCollection,
  product: Product,
) {
  const selected = editableScreenProduct(product);
  const source = renderedBundlePhotos(campaign).get(selected);
  return source &&
    normalizeScreenPhotoSource(source) !==
      normalizeScreenPhotoSource(screenPhotoSource(selected))
    ? { ...selected, image: source }
    : selected;
}

export function campaignTelevisionPhotos(campaign: ProductCollection) {
  const sources = renderedBundlePhotos(campaign);
  return campaignTelevisions(campaign).map((product) => {
    const source = sources.get(product);
    return source &&
      normalizeScreenPhotoSource(source) !==
        normalizeScreenPhotoSource(screenPhotoSource(product))
      ? { ...product, image: source }
      : product;
  });
}

// Works on the campaign draft; each TV retains geometry measured for its own photo.
export function applyTvWallpaper(
  campaign: ProductCollection,
  selectedCode: string | number,
  screenArtwork: ScreenArtwork | null,
  scope = "one",
  fitPlan?: TvWallpaperFitPlan,
) {
  const products = campaignProducts(campaign?.products);
  const matchesCode = (product: Product) =>
    String(product.code) === String(selectedCode);
  const selectedProduct =
    campaign?.products?.find(matchesCode) || products.find(matchesCode);
  if (!selectedProduct) return 0;
  const sources = renderedBundlePhotos(campaign);
  const originalSelected = editableScreenProduct(selectedProduct);
  const selected =
    scope !== "all" && fitPlan
      ? campaignTelevisions(campaign).find(
          (product) =>
            String(product.code) === String(originalSelected.code) &&
            fitPlan.fits.some(
              (fit) =>
                fit.code === String(product.code) &&
                normalizeScreenPhotoSource(fit.detectedFor) ===
                  normalizeScreenPhotoSource(
                    sources.get(product) || screenPhotoSource(product),
                  ),
            ),
        ) || originalSelected
      : originalSelected;
  const targets =
    scope === "all" && isTelevision(selected)
      ? campaignTelevisions(campaign)
      : [selected];
  let applied = 0;
  for (const product of targets) {
    if (screenArtwork == null) {
      delete product.screenArtwork;
    } else if (fitPlan) {
      const fitted = fitPlan.fits.find(
        (item) =>
          item.code === String(product.code) &&
          normalizeScreenPhotoSource(item.detectedFor) ===
            normalizeScreenPhotoSource(
              sources.get(product) || screenPhotoSource(product),
            ),
      );
      if (!fitted) continue;
      product.screenArtwork = {
        image: screenArtwork.image,
        fit: screenArtwork.fit || "cover",
        box: { ...fitted.box },
        detectedFor: fitted.detectedFor,
      };
    } else if (product === selected) {
      product.screenArtwork = structuredClone(screenArtwork);
    } else if (product.screenArtwork?.box) {
      product.screenArtwork = {
        ...product.screenArtwork,
        image: screenArtwork.image,
        ...(screenArtwork.fit ? { fit: screenArtwork.fit } : {}),
      };
    } else {
      product.screenArtwork = {
        image: screenArtwork.image,
        ...(screenArtwork.fit ? { fit: screenArtwork.fit } : {}),
      };
    }
    applied++;
  }
  return applied;
}
