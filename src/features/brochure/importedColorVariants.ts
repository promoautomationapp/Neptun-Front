import type { Product } from "../../domain/models";
import { importCode, isBundleOffer } from "./productBundles";
import { normalize } from "./utils";

export interface ImportedColor {
  name: string;
  hex: string;
}

// Longest phrases come first so a named finish remains a single color choice.
const COLOR_WORDS: [string, string][] = [
  ["natural titanium", "#b9b3a7"],
  ["black titanium", "#3c3c3d"],
  ["white titanium", "#d9d9d6"],
  ["blue titanium", "#4b5360"],
  ["stainless steel", "#b5babd"],
  ["space black", "#30343a"],
  ["deep blue", "#1d395b"],
  ["dark blue", "#243f75"],
  ["sky blue", "#8bc5e9"],
  ["light blue", "#9ac9e5"],
  ["gracier blue", "#9bc8df"],
  ["glacier blue", "#9bc8df"],
  ["cosmic orange", "#dc7b49"],
  ["light gold", "#d9c7a4"],
  ["pink gold", "#d9ada4"],
  ["mocha brown", "#91705d"],
  ["space grey", "#777c82"],
  ["space gray", "#777c82"],
  ["gaphite grey", "#575d62"],
  ["graphite grey", "#575d62"],
  ["e argjendte", "#c9ced1"],
  ["e gjelber", "#4d9c7d"],
  ["e kaltert", "#4f8fc7"],
  ["e kalter", "#4f8fc7"],
  ["e bardhe", "#f5f5f1"],
  ["i bardhe", "#f5f5f1"],
  ["e zeze", "#25292e"],
  ["i zi", "#25292e"],
  ["e kuqe", "#c95051"],
  ["i kuq", "#c95051"],
  ["e verdhe", "#efca49"],
  ["e arte", "#ccae65"],
  ["starlight", "#e8e1d1"],
  ["midnight", "#303944"],
  ["lavender", "#b8a3cf"],
  ["cream", "#eee5cd"],
  ["mint", "#b0d6c0"],
  ["navy", "#243f75"],
  ["steel", "#b5babd"],
  ["inox", "#b5babd"],
  ["black", "#25292e"],
  ["white", "#f5f5f1"],
  ["silver", "#c9ced1"],
  ["grey", "#8d9398"],
  ["gray", "#8d9398"],
  ["graphite", "#575d62"],
  ["gaphit", "#575d62"],
  ["green", "#4d9c7d"],
  ["blue", "#4f8fc7"],
  ["violet", "#8c77b5"],
  ["purple", "#8c77b5"],
  ["red", "#c95051"],
  ["pink", "#e7a8bd"],
  ["beige", "#c9b79d"],
  ["gold", "#ccae65"],
  ["brown", "#806751"],
  ["yellow", "#efca49"],
  ["orange", "#dc7b49"],
  ["squad", "#6e7659"],
  ["vjollce", "#8c77b5"],
  ["portokalli", "#dc7b49"],
  ["argjend", "#c9ced1"],
  ["bezhe", "#c9b79d"],
  ["roze", "#e7a8bd"],
  ["kafe", "#806751"],
  ["gri", "#8d9398"],
  ["hiri", "#8d9398"],
  ["blu", "#4f8fc7"],
];

const colorPattern = new RegExp(
  `(^|[^a-z0-9])(${COLOR_WORDS.map(([name]) => name).join("|")})(?=$|[^a-z0-9])`,
  "g",
);

export function importedColor(value: unknown): ImportedColor | null {
  const matches = [...normalize(String(value ?? "")).matchAll(colorPattern)];
  // The finish normally follows the model; this also avoids a brand such as
  // BLACK+DECKER overriding the WHITE finish at the end of a description.
  const name = matches.at(-1)?.[2];
  const hex = COLOR_WORDS.find(([word]) => word === name)?.[1];
  return name && hex ? { name, hex } : null;
}

function comparableModelCode(value: string, modelName = value) {
  // These sheets include a finish-specific Samsung stock suffix as well as the
  // shared named model. Keep the SM base and the full Buds/Watch generation and
  // size; a different base or named model must never become a color choice.
  return /\bsamsung\b/i.test(modelName) &&
    /\b(?:buds|watch)\s*\d/i.test(modelName)
    ? value.replace(/\b(sm-[rl]\d{3})[a-z0-9]{4,}\b/gi, "$1")
    : value;
}

/** Color and stock-condition labels are not model names. Capacities, sizes,
 * generations and identifying model bases remain part of the comparison. */
export function colorVariantName(value: string) {
  return comparableModelCode(normalize(value))
    .replace(colorPattern, "$1 ")
    .replace(/\bdemo\b/g, " ")
    .replace(/[\s,;:()[\]{}]+/g, " ")
    .trim();
}

/** Keep the original model typography while hiding its selected finish. */
function displayVariantName(value: string, color: ImportedColor | null) {
  if (!color) return value;
  const matches = [...normalize(value).matchAll(colorPattern)].filter(
    (match) => {
      const name = match[2]!;
      return (
        name === color.name ||
        COLOR_WORDS.find(([word]) => word === name)?.[1] === color.hex ||
        name.endsWith(` ${color.name}`) ||
        color.name.endsWith(` ${name}`)
      );
    },
  );
  let result = value;
  // The last matching phrase is the finish. Preserve a color word that is
  // also part of the brand, for example BLACK+DECKER ... BLACK.
  for (const match of matches.slice(-1)) {
    const start = match.index! + match[1]!.length;
    result = result.slice(0, start) + result.slice(start + match[2]!.length);
  }
  return (
    comparableModelCode(result)
      .replace(/\bdemo\b/gi, " ")
      .replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, " ")
      .replace(/([([{])\s*[,;]\s*/g, "$1")
      .replace(/[,;]\s*([)\]}])/g, "$1")
      .replace(/\s+/g, " ")
      .replace(/\s*[-–—|,;/]\s*$/, "")
      .trim() || value
  );
}

export function productImportColor(product: Product, explicit?: unknown) {
  return (
    importedColor(explicit) ||
    importedColor(product.name) ||
    Object.entries(product.specs || {})
      .filter(([key]) => /colou?r|ngjyr/i.test(key))
      .map(([, value]) => importedColor(value))
      .find((color) => color !== null) ||
    null
  );
}

function comparableDetails(product: Product) {
  return (product.brochureDetails || [])
    .map((detail) => (typeof detail === "string" ? detail : detail.text))
    .filter((detail) => !/^\s*(?:colou?r|ngjyr\w*)\s*:/i.test(detail))
    .map((detail) => normalize(detail).replace(/\s+/g, " "))
    .filter(Boolean)
    .sort()
    .join("\n");
}

function variantSpecificFact(key: string) {
  const label = normalize(key).replace(/[_-]+/g, " ");
  return (
    /colou?r|ngjyr/i.test(label) ||
    /\b(?:sku|ean|barcode|upc|gtin|mpn|asin|serial)\b/.test(label) ||
    /^(?:name|catalog(?:ue)? (?:name|title)|emertim\w*|kodi|product (?:name|code|url|link)|item (?:name|code|number)|model code|manufacturer part number|selected variant|image url|imageurl)(?:\s|$)/.test(
      label,
    )
  );
}

function comparableFact(product: Product, key: string, value: unknown) {
  const text = comparableModelCode(normalize(String(value)), product.name);
  return (/model/i.test(key) ? colorVariantName(text) : text).replace(
    /\s+/g,
    " ",
  );
}

/** A repeated slot is not sufficient evidence that two SKUs are color options. */
export function sameColorVariantModel(left: Product, right: Product) {
  const family = colorVariantName(left.name);
  if (!family || family !== colorVariantName(right.name)) return false;
  if (
    left.brand &&
    right.brand &&
    normalize(left.brand) !== normalize(right.brand)
  )
    return false;
  if (
    !(Number(left.regular) > 0) ||
    Number(left.regular) !== Number(right.regular) ||
    !(Number(left.sale) > 0) ||
    Number(left.sale) !== Number(right.sale)
  )
    return false;
  if (
    left.warranty &&
    right.warranty &&
    normalize(left.warranty) !== normalize(right.warranty)
  )
    return false;
  const leftDetails = comparableDetails(left);
  const rightDetails = comparableDetails(right);
  if (leftDetails && rightDetails && leftDetails !== rightDetails) return false;
  const rightFacts = new Map(
    Object.entries(right.specs || {})
      .filter(([key]) => !variantSpecificFact(key))
      .map(([key, value]) => [
        normalize(key),
        comparableFact(right, key, value),
      ]),
  );
  return Object.entries(left.specs || {}).every(([key, value]) => {
    if (variantSpecificFact(key)) return true;
    const factKey = normalize(key);
    return (
      !rightFacts.has(factKey) ||
      rightFacts.get(factKey) === comparableFact(left, key, value)
    );
  });
}

export interface ColorVariantCandidate {
  product: Product;
  color: ImportedColor | null;
  eligible?: boolean;
  /** Sheet prices can describe the shared offer without changing member facts. */
  regular?: number | string | null;
  sale?: number | null;
}

/** Preserve the first product's artwork/facts and one price for every model. */
export function collapseImportedColorVariants(
  candidates: readonly ColorVariantCandidate[],
) {
  const collapsed: ColorVariantCandidate[] = [];
  for (const candidate of candidates) {
    const parent = collapsed.find(
      (entry) =>
        candidate.eligible !== false &&
        entry.eligible !== false &&
        entry.color &&
        candidate.color &&
        !isBundleOffer(entry.product) &&
        !isBundleOffer(candidate.product) &&
        sameColorVariantModel(
          {
            ...entry.product,
            regular: entry.regular ?? entry.product.regular,
            sale: String(entry.sale ?? entry.product.sale ?? ""),
          },
          {
            ...candidate.product,
            regular: candidate.regular ?? candidate.product.regular,
            sale: String(candidate.sale ?? candidate.product.sale ?? ""),
          },
        ),
    );
    if (!parent) {
      collapsed.push({
        ...candidate,
        product: structuredClone(candidate.product),
      });
      continue;
    }
    const product = parent.product;
    product.brochureVariants ||= [
      {
        code: product.code,
        name: product.name,
        color: parent.color || undefined,
      },
    ];
    const variants = candidate.product.brochureVariants || [
      {
        code: candidate.product.code,
        name: candidate.product.name,
        color: candidate.color || undefined,
      },
    ];
    for (const variant of variants) {
      if (
        !product.brochureVariants.some(
          (existing) => importCode(existing.code) === importCode(variant.code),
        )
      )
        product.brochureVariants.push(structuredClone(variant));
    }
    if (product.brochureVariants.length > 1)
      product.name = displayVariantName(product.name, parent.color);
    if (candidate.product.catalogMissing) {
      product.catalogMissing = true;
      product.missingCatalogCodes = [
        ...new Set([
          ...(product.missingCatalogCodes || []),
          ...(candidate.product.missingCatalogCodes || [
            candidate.product.code,
          ]),
        ]),
      ];
    }
    if (!product.image && candidate.product.image)
      product.image = candidate.product.image;
  }
  return collapsed;
}
