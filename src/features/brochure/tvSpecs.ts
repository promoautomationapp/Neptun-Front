import type { Product } from "../../domain/models";
import { isAppleProduct } from "./priceDesign";

export function isTelevision(product: Partial<Product>) {
  const category = String(product.subcategory || "")
    .trim()
    .toUpperCase();
  return (
    category === "TV" ||
    (!category &&
      /^TV\s+(?:LED|QLED|OLED|QNED|MINI\s+LED)\b/i.test(product.name || ""))
  );
}

export function hasEditableScreen(product: Partial<Product>) {
  if (isTelevision(product)) return true;
  const text = `${product.category || ""} ${product.subcategory || ""} ${product.name || ""}`;
  return /\b(?:laptop|notebook|macbook|tablet|ipad|monitor|iphone|smartphone|telefon|redmi|galaxy|watch|smartwatch|A\d{2,3}|S\d{2,3}\+?|xiaomi\s+\d{1,2}[a-z]?)\b/i.test(
    text,
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

// A gentle size cue within each photo slot, rather than a literal physical-size ratio.
// Keep the largest supported TV inside the slot; saved manual scales take precedence.
export function defaultProductImageScale(product: Partial<Product>) {
  const inches = tvScreenInches(product);
  return inches ? Number((0.94 + (0.06 * (inches - 20)) / 100).toFixed(3)) : 1;
}

export function otherScreenInches(product: Partial<Product>) {
  if (isAppleProduct(product)) return null;
  const category = String(product.subcategory || "")
    .trim()
    .toUpperCase();
  const name = String(product.name || "");
  const isPhone =
    /^(?:SMARTPHONES?|PHONE|TELEFON(?:A|I| CELULAR)?)$/.test(category) ||
    (!category &&
      /^(?:SMARTPHONE|PHONE|TELEFON|GALAXY|REDMI|SAMSUNG\s+(?:GALAXY|[AS]\d)|XIAOMI\s+\d)\b/i.test(
        name,
      ));
  const isScreenCategory =
    isPhone ||
    /^(?:LAPTOP(?: GAMING)?|TABLETË?|MONITOR(?: GAMING)?)$/.test(category);
  if (
    !isScreenCategory &&
    (category || !/^(?:LAPTOP|TABLET|MONITOR)\b/i.test(name))
  )
    return null;
  const screenSpec = Object.entries(product.specs || {}).find(([key]) =>
    /ekran|display|screen\s*size|p[ëe]rmasat|diagonal/i.test(key),
  );
  const source = String(screenSpec?.[1] || name);
  const match = source.match(
    /\b(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:["″”]|inch|inç)/i,
  );
  if (!match) return null;
  const inches = Number((match[1] ?? "").replace(",", "."));
  return inches >= (isPhone ? 3 : 7) && inches <= 50 ? inches : null;
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
