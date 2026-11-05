import type { Product } from "../../domain/models";
import { isAppleProduct } from "./priceDesign";
import { isBrochureAccessory, isMobilePhone } from "./productTypes";

const normalized = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

function screenCategories(product: Partial<Product>) {
  const path = String(product.categoryPath || "")
    .split(/\s*(?:>|›)\s*/)
    .filter(Boolean)
    .reverse();
  return [...path, product.subcategory, product.category]
    .map(normalized)
    .filter(Boolean);
}

function screenAccessory(product: Partial<Product>) {
  const specific = screenCategories(product)[0] || "";
  return (
    isBrochureAccessory(product) ||
    isBrochureAccessory({ ...product, subcategory: specific }) ||
    /\b(?:COVERS?|CASES?|SLEEVES?|PROTECTORS?|SCREEN\s+PROTECTION|MBROJTES\w*|MBESHTJELLESE\w*|MBAJTES\w*|MBUSHES\w*|KABLLO\w*|CHARGERS?|ADAPTERS?|ADAPTORS?|CABLES?|SPARE\s+PARTS?|PJES\w*\s+REZERV\w*|REPLACEMENT\s+(?:SCREENS?|DISPLAYS?)|(?:SCREENS?|DISPLAYS?)\s+REPLACEMENT)\b/.test(
      `${specific} ${normalized(product.name)}`,
    )
  );
}

type OtherScreenKind = "phone" | "tablet" | "laptop" | "monitor";
function namedScreenKind(value: string): OtherScreenKind | null {
  if (
    /^(?:TABLET(?:E|A|ET|AT|S)?|(?:APPLE\s+)?IPAD|(?:SAMSUNG\s+)?(?:GALAXY\s+)?TAB|(?:HUAWEI\s+)?MATEPAD|(?:XIAOMI\s+)?REDMI\s+PAD)(?:\s|$)/.test(
      value,
    )
  )
    return "tablet";
  if (
    /^(?:(?:GAMING\s+)?(?:LAPTOP(?:E|ET|S)?|NOTEBOOKS?|ULTRABOOKS?)|(?:APPLE\s+)?MAC\s*BOOK|KOMPJUTER(?:A|E|ET)?\s+PORTATIV(?:E|I)?)(?:\s|$)/.test(
      value,
    )
  )
    return "laptop";
  if (
    /^(?:MONITOR(?:E|ET|S)?|EKRAN(?:E|ET|I|A)?|SCREENS?|DISPLAYS?)(?:\s|$)/.test(
      value,
    )
  )
    return "monitor";
  return null;
}

function otherScreenKind(product: Partial<Product>): OtherScreenKind | null {
  if (screenAccessory(product)) return null;
  for (const category of screenCategories(product)) {
    const kind = namedScreenKind(category);
    if (kind) return kind;
  }
  // A generic category or a manufacturer leaf must not hide an explicit device
  // name. Tablet families are checked before Redmi/Galaxy phone recognition.
  return (
    namedScreenKind(normalized(product.name)) ||
    (isMobilePhone(product) ? "phone" : null)
  );
}

export function isTelevision(product: Partial<Product>) {
  if (screenAccessory(product)) return false;
  const subcategory = normalized(product.subcategory);
  const category = normalized(product.category);
  const televisionCategory =
    /^(?:TV|TELEVIZOR(?:E|ET)?|TELEVISIONS?)(?:\s+(?:LED|QLED|OLED|QNED|MINI\s*LED))?$/;
  return (
    televisionCategory.test(subcategory) ||
    (televisionCategory.test(category) &&
      (!subcategory ||
        /^(?:LED|QLED|OLED|QNED|MINI\s*LED)$/.test(subcategory))) ||
    /^TV\s+(?:LED|QLED|OLED|QNED|MINI\s+LED)\b/i.test(product.name || "")
  );
}

export function hasEditableScreen(product: Partial<Product>) {
  if (isAppleProduct(product) || screenAccessory(product)) return false;
  if (isTelevision(product)) return true;
  if (otherScreenKind(product)) return true;
  return /\b(?:SMARTWATCH|WATCH)\b/.test(
    normalized(
      `${product.category || ""} ${product.subcategory || ""} ${product.name || ""}`,
    ),
  );
}

export function tvScreenInches(product: Partial<Product>) {
  if (isAppleProduct(product)) return null;
  if (!isTelevision(product)) return null;
  const specs = Object.entries(product.specs || {});
  const sizeSpec = specs.find(([key]) =>
    /p[ëe]rmasat|diagonal|screen\s*size|ekran|display/i.test(key),
  );
  const sizeSources = [
    sizeSpec?.[1],
    ...(product.brochureDetails || []).map((detail) =>
      typeof detail === "string" ? detail : detail.text,
    ),
    product.name,
  ];
  const explicitSize = sizeSources
    .map((source) =>
      String(source || "").match(/\b(\d{2,3})\s*(?:["″”]|inch|inç)/i),
    )
    .find(
      (match) => match && Number(match[1]) >= 20 && Number(match[1]) <= 120,
    );
  if (explicitSize) {
    const inches = Number(explicitSize[1]);
    if (inches >= 20 && inches <= 120) return inches;
  }
  const model =
    String(product.name || "")
      .trim()
      .split(/\s+/)
      .at(-1) || "";
  const modelSize = [
    ...model.matchAll(/(?:^|[A-Z])((?:1[01]\d|[2-9]\d))(?=[A-Z])/gi),
  ]
    .map((match) => Number(match[1]))
    .find((inches) => inches >= 20 && inches <= 120);
  return modelSize || null;
}

// Keep a visible size difference between common 55/65-inch offers without
// letting larger TVs escape the photo slot. Above 65 inches, taper gradually
// while retaining a size difference for every neighboring inch.
// Saved manual scales take precedence.
export function defaultProductImageScale(product: Partial<Product>) {
  const inches = tvScreenInches(product);
  if (!inches) return 1;
  const scale =
    inches <= 65
      ? 0.615 + (inches - 20) * 0.007
      : 0.93 + 0.07 * (1 - Math.exp(-(inches - 65) / 30));
  return Number(Math.min(1, scale).toFixed(4));
}

export function otherScreenInches(product: Partial<Product>) {
  if (isAppleProduct(product)) return null;
  const kind = otherScreenKind(product);
  if (!kind) return null;
  const screenSpecs = Object.entries(product.specs || {}).filter(([key]) =>
    /ekran|display|screen\s*size|p[ëe]rmasat|diagonal/i.test(key),
  );
  const sources = [
    ...screenSpecs.map(([, value]) => value),
    ...(product.brochureDetails || []).map((detail) =>
      typeof detail === "string" ? detail : detail.text,
    ),
    product.name,
  ];
  for (const source of sources) {
    const match = String(source || "").match(
      /\b(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:["″”]|inch|inç)/i,
    );
    if (!match) continue;
    const inches = Number((match[1] ?? "").replace(",", "."));
    if (inches >= (kind === "phone" ? 3 : 7) && inches <= 50) return inches;
  }
  return null;
}

export function screenAnnotationType(product: Partial<Product>) {
  if (isAppleProduct(product)) return "none";
  return isTelevision(product)
    ? "television"
    : hasEditableScreen(product)
      ? "other"
      : "none";
}

export function displaySpecs(product: Partial<Product>) {
  const specs = { ...(product.specs || {}) };
  if (product.autoSpecsDisabled) return specs;
  if (!isTelevision(product)) return specs;
  const inches = tvScreenInches(product);
  if (
    inches &&
    !Object.keys(specs).some((key) =>
      /p[ëe]rmasat|diagonal|screen\s*size/i.test(key),
    )
  ) {
    specs["Përmasat"] = `${inches}″`;
  }
  if (Object.keys(specs).length === (inches ? 1 : 0)) {
    const panel = String(product.name || "").match(
      /^TV\s+(MINI\s+LED|QNED|QLED|OLED|LED)\b/i,
    )?.[1];
    if (panel) specs.Teknologjia = panel.toUpperCase().replace(/\s+/g, " ");
  }
  return specs;
}
