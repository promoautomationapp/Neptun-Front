import type { Product, Artwork, Campaign } from "../../domain/models";
import { reflowDefaultLargeBundleImages } from "./largeBundleLayout";
import { defaultProductImageScale } from "./tvSpecs";
import { productDesignFor } from "../settings/product-design-defaults";
import { bundleMemberByCode } from "./bundleMemberUpdates";
import { catalogDetailFacts, savedDetailEntries } from "./detailFacts";
const BADGE_ROOT = "/api/assets/legacy/assets/product-badges";
const FEATURE_WORDS = {
  wifi: /\bwi[\s_-]?fi\b/i,
  inverter: /\binverter\b/i,
};

function plainText(value: unknown) {
  return String(value ?? "")
    .replace(/<br\s*\/?\s*>|<\/p>|<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:euml|Euml);/g, "e")
    .replace(/&(?:ccedil|Ccedil);/g, "c")
    .replace(/&nbsp;/g, " ")
    .replace(/&deg;/g, "°")
    .replace(/&amp;/g, "&")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function entries(value: unknown, prefix = ""): Array<[string, unknown]> {
  if (Array.isArray(value))
    return value.flatMap((item) => entries(item, prefix));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      entries(item, `${prefix} ${key}`.trim()),
    );
  }
  return value == null ? [] : [[prefix, value]];
}

function sourceEntries(product: Partial<Product>): Array<[string, string]> {
  return [
    ...entries(product.specs),
    ...entries(product.features),
    ...(savedDetailEntries(product) || []),
    ...catalogDetailFacts(product).map(
      ({ key, value }) => [key, value] as [string, string],
    ),
    ...entries(product.postDetails),
    ...entries(product.description),
    ...entries(product.name),
    ...Object.entries(product).filter(([key]) =>
      /^(?:wi[\s_-]?fi|haswifi|supports?wifi|inverter|hasinverter|energyclass|energyrating|energylabel)$/i.test(
        key,
      ),
    ),
  ].map(([key, value]) => [plainText(key), plainText(value)]);
}

export function isAirConditioner(product: Partial<Product> = {}) {
  const category = plainText(
    `${product.category || ""} ${product.subcategory || ""}`,
  );
  const name = plainText(product.name);
  if (
    /aksesore|accessor|telekomand|remote|mbrojtes|cover|usb\s+wireless/i.test(
      `${category} ${name}`,
    )
  )
    return false;
  const ac =
    /\b(?:kondicioner|kondicionere|conditioner|conditioners|air[\s-]*conditioning|klima|klime|klimatik|klimatizim)\b/i;
  return (
    ac.test(category) ||
    /^(?:KONDICIONER|AIR[\s-]*CONDITIONER|KLIMA)\b/i.test(name)
  );
}

const explicitNo =
  /^(?:false|no|jo|0|none|n\/a|pa|nuk\s+(?:ka|mbeshtet\w*)|not\s+(?:available|supported|included)|disabled|off|optional|opsionale?)\b/i;

function mentionsFeature(
  key: string,
  value: string,
  feature: keyof typeof FEATURE_WORDS,
) {
  const words = FEATURE_WORDS[feature];
  const featureKey = words.test(key.replace(/^(?:has|supports?)/i, ""));
  if (featureKey && !value) return 0;
  if (featureKey && explicitNo.test(value)) return -1;
  if (
    featureKey &&
    /^(?:true|yes|po|1|supported|available|included)$/i.test(value)
  )
    return 1;
  const clauses = `${key}: ${value}`.split(/[\n;,|]|\b(?:but|por|dhe|and)\b/i);
  let mentioned = false;
  for (const clause of clauses) {
    const match = clause.match(words);
    if (!match) continue;
    mentioned = true;
    const before = clause.slice(
      Math.max(0, (match.index ?? 0) - 28),
      match.index ?? 0,
    );
    const after = clause.slice((match.index ?? 0) + match[0].length);
    if (
      /(?:\b(?:no|not|without|pa|jo|false|non|nuk\s+ka)\s*[-:]?\s*)$/i.test(
        before,
      ) ||
      /^\s*[-:]?\s*(?:no|jo|false|0|none|nuk\s+(?:ka|mbeshtet\w*)|not\s+(?:available|supported|included)|disabled|off|optional|opsionale?|ready)\b/i.test(
        after,
      )
    )
      return -1;
  }
  return mentioned ? 1 : 0;
}

function hasFeature(
  source: Array<[string, string]>,
  feature: keyof typeof FEATURE_WORDS,
) {
  const states = source.map(([key, value]) =>
    mentionsFeature(key, value, feature),
  );
  // An explicit denial wins over a feature word embedded in a model name or description.
  return !states.includes(-1) && states.includes(1);
}

function hasInverter(source: Array<[string, string]>) {
  if (source.some(([key, value]) => mentionsFeature(key, value, "inverter") === -1))
    return false;
  return hasFeature(source, "inverter") || source.some(([key, value]) => {
    const text = `${key} ${value}`;
    return /°|temperatur|temperature/i.test(text) &&
      /[-−]\s*\d+(?:[.,]\d+)?\s*°?\s*c?[\s\S]{0,50}\+\s*\d+(?:[.,]\d+)?\s*°?\s*c?/i.test(text);
  });
}

/** Correct only the shipped energy badge; custom uploaded icons stay intact. */
export function productBadgeImage(image: string | undefined) {
  return image === `${BADGE_ROOT}/energy-a-plus-plus-plus.svg` ||
    image === "/assets/product-badges/energy-a-plus-plus-plus.svg"
    ? "/product-badges/energy-a-plus-plus-plus.svg"
    : image;
}

function firstEnergyClass(text: string) {
  return (
    text
      .match(/\bA\s*(\+{0,3})(?![\w+])/i)?.[0]
      .replace(/\s/g, "")
      .toUpperCase() || null
  );
}

function energyClass(source: Array<[string, string]>) {
  const keyed = source.filter(([key]) => /energ|efficien|klas/i.test(key));
  for (const [, value] of keyed) {
    if (explicitNo.test(value)) return null;
    const grade = firstEnergyClass(value);
    if (grade) return grade === "A++" || grade === "A+++" ? grade : null;
  }
  for (const [key, value] of source) {
    const text = `${key} ${value}`;
    const grade = firstEnergyClass(text);
    if (grade === "A++" || grade === "A+++") {
      if (/\b(?:no|not|without|pa|jo|false)\s*[:=-]?\s*A\s*\+/i.test(text))
        continue;
      return grade;
    }
  }
  return null;
}

export function airConditionerFeatures(
  product: Partial<Product>,
  sourceDefaults: { wifi?: boolean; inverter?: boolean } = {},
) {
  const source = [
    ...Object.entries(sourceDefaults).map(
      ([key, value]) => [key, String(value)] as [string, string],
    ),
    ...sourceEntries(product),
  ];
  return {
    wifi: isAirConditioner(product) && hasFeature(source, "wifi"),
    inverter: isAirConditioner(product) && hasInverter(source),
    energy: isAirConditioner(product) && energyClass(source) === "A+++",
  };
}

export function defaultProductArtworks(
  product: Partial<Product> = {},
  campaign: Partial<Campaign> = {},
) {
  if (isBundleOffer(product)) {
    const photo = productDesignFor(campaign).photo;
    return defaultBundleImages(product).map((artwork) => {
      const member = bundleMemberByCode(product, artwork.memberCode || "");
      const scale =
        member && photo.mode === "automatic" && photo.automaticTvSizing
          ? defaultProductImageScale(member)
          : 1;
      if (scale === 1) return artwork;
      const width = artwork.width || 0;
      const height = artwork.height || 0;
      return {
        ...artwork,
        fitVisiblePhoto: true,
        x: (artwork.x || 0) + (width * (1 - scale)) / 2,
        y: (artwork.y || 0) + (height * (1 - scale)) / 2,
        width: width * scale,
        height: height * scale,
      };
    });
  }
  if (!isAirConditioner(product)) return [];
  const source = sourceEntries(product);
  const artworks: Artwork[] = [];
  if (hasFeature(source, "wifi"))
    artworks.push({
      id: "ac-wifi",
      type: "wifi",
      label: "WiFi",
      image: `${BADGE_ROOT}/wifi.svg`,
      relativeTo: "image",
      x: 90,
      y: -28,
      width: 10,
    });
  if (hasInverter(source))
    artworks.push({
      id: "ac-inverter",
      type: "inverter",
      label: "+inverter",
      image: `${BADGE_ROOT}/inverter.svg`,
      relativeTo: "image",
      x: 3,
      y: 8,
      width: 32,
    });
  const grade = energyClass(source);
  if (grade === "A+++")
    artworks.push({
      id: "ac-energy",
      type: "energy",
      label: grade,
      image: `${BADGE_ROOT}/${grade === "A+++" ? "energy-a-plus-plus-plus" : "energy-a-plus-plus"}.svg`,
      relativeTo: "image",
      x: 3,
      y: 47,
      width: 12,
    });
  return artworks.flatMap((artwork) => {
    const key =
      artwork.type === "energy"
        ? artwork.label === "A+++"
          ? "energy-a-plus-plus-plus"
          : "energy-a-plus-plus"
        : artwork.type;
    const choice = key ? campaign.iconDefaults?.[key] : undefined;
    return choice?.visible === false
      ? []
      : [{ ...artwork, image: productBadgeImage(choice?.image || artwork.image) }];
  });
}

export function effectiveProductArtworks(
  product: Partial<Product> = {},
  campaign: Partial<Campaign> = {},
) {
  // An empty saved list records deletion; never regenerate defaults over that edit.
  if (!Array.isArray(product.productArtworks))
    return defaultProductArtworks(product, campaign);
  const artworks = reflowDefaultLargeBundleImages(
    product,
    product.productArtworks,
  ).map((artwork) => ({ ...artwork, image: productBadgeImage(artwork.image) }));
  return artworks.some((item) => item.usesPrimaryImage)
    ? artworks.map((item) =>
        item.usesPrimaryImage ? { ...item, image: product.image } : item,
      )
    : artworks;
}
import { defaultBundleImages, isBundleOffer } from "./productBundles";
