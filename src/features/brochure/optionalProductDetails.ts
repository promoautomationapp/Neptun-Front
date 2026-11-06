import type { Product } from "../../domain/models";
import {
  detailPlainText,
  normalizedDetail,
  type DetailEntry,
} from "./detailFacts";
import { appleProductFamily } from "./productTypes";

export function isIphoneIosDetail(
  product: Partial<Product>,
  key: string,
  value: string,
) {
  if (appleProductFamily(product) !== "iphone") return false;
  const label = normalizedDetail(key).replace(/\s+/g, " ").trim();
  return (
    /\bios\b/i.test(`${label} ${detailPlainText(value)}`) ||
    (/^(?:os|sistemi(?: operativ)?|operating system|software)$/.test(label) &&
      /^\d+(?:\.\d+)*$/.test(detailPlainText(value)))
  );
}

/** Keep source rows intact: iOS is printed only after an explicit checkbox choice. */
export function visibleOptionalProductDetails(
  product: Partial<Product>,
  entries: readonly DetailEntry[],
): DetailEntry[] {
  return entries.filter(
    ([key, value]) =>
      !isIphoneIosDetail(product, key, value) ||
      product.detailBlockPlacements?.[key]?.hidden === false,
  );
}

export function iphoneIosDetailText(value: unknown) {
  return `iOS ${detailPlainText(value).replace(/^(?:iOS|OS|Sistemi(?: operativ)?|Operating system)\s*:?\s*/i, "")}`;
}
