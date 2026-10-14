import type {Campaign,Product,ScreenArtwork}from '../../domain/models';
import { isTelevision } from "./tvSpecs";

function campaignProducts(products: Product[], result:Product[] = []) {
  for (const product of products || []) {
    result.push(product);
    if (Array.isArray(product.bundleProducts)) campaignProducts(product.bundleProducts, result);
  }
  return result;
}

export function campaignTelevisions(campaign: Campaign) {
  return campaignProducts(campaign?.products).filter(isTelevision);
}

// Works on the campaign draft; each TV retains geometry measured for its own photo.
export function applyTvWallpaper(campaign: Campaign, selectedCode:string|number, screenArtwork:ScreenArtwork|null, scope = "one") {
  const products = campaignProducts(campaign?.products);
  const matchesCode = (product: Product) => String(product.code) === String(selectedCode);
  const selected = campaign?.products?.find(matchesCode) || products.find(matchesCode);
  if (!selected) return 0;
  const targets = scope === "all" && isTelevision(selected) ? campaignTelevisions(campaign) : [selected];
  for (const product of targets) {
    if (screenArtwork == null) {
      delete product.screenArtwork;
    } else if (product === selected) {
      product.screenArtwork = structuredClone(screenArtwork);
    } else if (product.screenArtwork?.box) {
      product.screenArtwork = { ...product.screenArtwork, image: screenArtwork.image, ...(screenArtwork.fit ? { fit: screenArtwork.fit } : {}) };
    } else {
      product.screenArtwork = { image: screenArtwork.image, ...(screenArtwork.fit ? { fit: screenArtwork.fit } : {}) };
    }
  }
  return targets.length;
}
