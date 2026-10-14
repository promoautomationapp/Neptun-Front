import type { Product } from "../../domain/models";
import { normalize } from "./utils";
import { savedDetailEntries } from "./detailFacts";
import {
  defaultLargeBundleImages,
  isLargeBundleOffer,
} from "./largeBundleLayout";

export function importCode(value: unknown) {
  return normalize(String(value ?? "").replace(/\.0+$/, "")).replace(
    /[\s\-_]/g,
    "",
  );
}

export function catalogByCode(catalog: Product[]) {
  const lookup = new Map<string, Product>();
  for (const product of catalog) {
    const key = importCode(product.code);
    if (key && !lookup.has(key)) lookup.set(key, product);
  }
  return lookup;
}

export function isBundleOffer(product: Partial<Product>) {
  return (
    Array.isArray(product?.bundleProducts) && product.bundleProducts.length > 1
  );
}

function frontProduct(products: Product[]) {
  // The oven sits in front of the hob in the supplied bundle layout.
  return (
    products.find((product: Product) =>
      /\b(?:furre|oven)\b/.test(
        normalize(`${product.subcategory || ""} ${product.name || ""}`),
      ),
    ) || products[0]
  );
}

export function createBundleOffer(products: Product[]): Product {
  const primary = frontProduct(products);
  if (!primary) throw new Error("A bundle needs at least one product.");
  const members = [
    primary,
    ...products.filter((product: Product) => product !== primary),
  ];
  const codes = products.map((product: Product) => String(product.code));
  const brands = [
    ...new Set(
      products.map((product: Product) => product.brand).filter(Boolean),
    ),
  ];
  const warranty = products.every(
    (product: Product) => product.warranty === primary.warranty,
  )
    ? primary.warranty
    : "";
  const details = [];
  const seen = new Set();
  for (const product of members) {
    const saved = savedDetailEntries(product);
    for (const [key, value] of saved || Object.entries(product.specs || {})) {
      if (!value || /garanc|warrant|colou?r|ngjyr/i.test(key)) continue;
      const line = Array.isArray(product.brochureDetails)
        ? value
        : `${key}: ${value}`;
      if (!seen.has(normalize(line))) {
        details.push(line);
        seen.add(normalize(line));
      }
    }
  }
  return {
    code: [...codes]
      .sort((a, b) => importCode(a).localeCompare(importCode(b)))
      .join(" + "),
    name: members.map((product: Product) => product.name).join(" & "),
    brand: brands.join(" / "),
    category: "Bundle",
    subcategory: "Bundle",
    regular: products.every((product: Product) => Number(product.regular) > 0)
      ? Math.round(
          products.reduce(
            (sum, product: Product) => sum + Number(product.regular),
            0,
          ) * 100,
        ) / 100
      : 0,
    currency: primary.currency || "EUR",
    image: primary.image || primary.localImage || primary.imageUrl || "",
    warranty,
    bundleCodes: codes,
    bundleProducts: members.map((product: Product) => structuredClone(product)),
    ...(products.some((product) => product.catalogMissing)
      ? {
          catalogMissing: true,
          missingCatalogCodes: products.flatMap(
            (product) =>
              product.missingCatalogCodes ||
              (product.catalogMissing ? [product.code] : []),
          ),
        }
      : {}),
    ...(details.length ? { brochureDetails: details } : {}),
  };
}

export interface ResolvedOffer {
  product: Product | null;
  codes: string[];
  missingCodes: string[];
  bundle: boolean;
}

export function resolveOfferProduct(
  value: unknown,
  lookup: Map<string, Product>,
): ResolvedOffer {
  const text = String(value ?? "").trim();
  const exact = lookup.get(importCode(text));
  // Check the whole cell first, so punctuation in a real SKU remains valid.
  if (exact)
    return {
      product: exact,
      codes: [String(exact.code)],
      missingCodes: [],
      bundle: false,
    };
  // An absent model such as AKT8090/NE is one SKU, not a two-item offer.
  const slashSuffix = text.match(/^[^\s/]+\/([a-z]{1,5})$/i)?.[1];
  const singleModelSuffix = slashSuffix && !lookup.has(importCode(slashSuffix));
  let codes = singleModelSuffix
    ? [text]
    : text.split(/\s*(?:[+&,;|/\r\n]+|\b(?:and|dhe)\b)\s*/i).filter(Boolean);
  if (codes.length === 1) {
    const spaced = text.split(/\s+/).filter(Boolean);
    if (
      spaced.length > 1 &&
      spaced.every(
        (code) =>
          lookup.has(importCode(code)) ||
          /^\d{3,}(?:\.0+)?$/.test(code) ||
          /^(?=.*[a-z])(?=.*\d)[a-z\d_.-]{3,}$/i.test(code),
      )
    )
      codes = spaced;
  }
  codes = [...new Map(codes.map((code) => [importCode(code), code])).values()];
  const missingCodes = codes.filter((code) => !lookup.has(importCode(code)));
  if (missingCodes.length)
    return { product: null, codes, missingCodes, bundle: codes.length > 1 };
  const products = codes
    .map((code) => lookup.get(importCode(code)))
    .filter((product): product is Product => Boolean(product));
  return {
    product:
      products.length > 1 ? createBundleOffer(products) : products[0] || null,
    codes: products.map((product: Product) => String(product.code)),
    missingCodes: [],
    bundle: products.length > 1,
  };
}

export function defaultBundleImages(product: Partial<Product>) {
  if (!isBundleOffer(product)) return [];
  if (isLargeBundleOffer(product)) return defaultLargeBundleImages(product);
  const members = product.bundleProducts ?? [];
  return members.map((member, index) => {
    const count = members.length;
    const front = index === 0;
    const rowWidth = Math.min(61, 112 / count);
    const layout =
      count === 2
        ? front
          ? { x: 7, y: 30, width: 61, height: 70 }
          : { x: 36, y: 1, width: 61, height: 69 }
        : {
            x: 4 + (index * (92 - rowWidth)) / (count - 1),
            y: front ? 24 : 4,
            width: rowWidth,
            height: front ? 76 : 69,
          };
    return {
      id: `bundle-image-${member.code}`,
      type: "bundle-product",
      memberCode: String(member.code),
      label: member.name || String(member.code),
      image: front
        ? product.image
        : member.image || member.localImage || member.imageUrl || "",
      usesPrimaryImage: front,
      relativeTo: "photo-area",
      zIndex: front ? 3 : 2,
      ...layout,
    };
  });
}
