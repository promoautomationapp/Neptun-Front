import type { Artwork, Product } from "../../domain/models";
import { savedDetailEntries } from "./detailFacts";
import { isTelevision } from "./tvSpecs";

export type OptionalProductLabel = "new-model" | "capacity";
const prefix = "optional-product-label:";
const plain = (value: unknown) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export function supportsCapacityLabel(product: Partial<Product>) {
  const name = plain(
    `${product.name || ""} ${product.category || ""} ${product.subcategory || ""} ${product.categoryPath || ""}`,
  );
  if (
    /\b(?:accessor\w*|akses\w*|mbajtese|cover|spare|pjese|hose|detergjent\w*|hair|floke\w*)\b/i.test(
      name,
    )
  )
    return false;
  return /\b(?:washing\s+machines?|washer(?:s|[ -]dryer)?|laundry\s+dryers?|tumble\s+dryers?|dryers?|rrobalares\w*|lavatri[çc]\w*|tharese(?:\s+(?:te\s+)?(?:rrob\w*|tesha\w*))?|makine\s+lar\w*)\b/i.test(
    name,
  );
}
export function optionalProductLabelChoices(
  product: Partial<Product>,
): OptionalProductLabel[] {
  return isTelevision(product)
    ? ["new-model"]
    : supportsCapacityLabel(product)
      ? ["capacity"]
      : [];
}
export function inferredCapacityKg(product: Partial<Product>): string {
  const entries = [
    ...Object.entries(product.specs || {}),
    ...(savedDetailEntries(product) || []),
  ];
  for (const [key, value] of entries) {
    if (!/kapacitet|capacity|washing|drying|larj|tharj/i.test(plain(key)))
      continue;
    const match = plain(value).match(
      /(?:^|\s)(\d{1,2}(?:[.,]\d)?)(?:\s*\/\s*\d{1,2}(?:[.,]\d)?)?\s*(?:kg\b|$)/i,
    );
    if (
      match &&
      Number(match[1]!.replace(",", ".")) > 0 &&
      Number(match[1]!.replace(",", ".")) <= 30
    )
      return match[1]!.replace(",", ".");
  }
  const text = plain(
    `${product.description || ""} ${product.name || ""} ${entries
      .filter(([key]) => /capacity|kapacitet|larj|tharj/i.test(plain(key)))
      .map(([key, value]) => `${key}: ${value}`)
      .join(" ")}`,
  );
  const match = text.match(/\b(\d{1,2}(?:[.,]\d)?)\s*kg\b/i);
  return match &&
    Number(match[1]!.replace(",", ".")) > 0 &&
    Number(match[1]!.replace(",", ".")) <= 30
    ? match[1]!.replace(",", ".")
    : "";
}
export function optionalProductLabelKind(
  artwork: Artwork,
): OptionalProductLabel | null {
  return artwork.id.startsWith(`${prefix}new-model:`)
    ? "new-model"
    : artwork.id.startsWith(`${prefix}capacity:`)
      ? "capacity"
      : null;
}
export function hasOptionalProductLabel(
  artworks: Artwork[],
  kind: OptionalProductLabel,
) {
  return artworks.some(
    (item) => optionalProductLabelKind(item) === kind && !item.hidden,
  );
}
export function setOptionalProductLabel(
  artworks: Artwork[],
  kind: OptionalProductLabel,
  enabled: boolean,
  capacity = "",
): Artwork[] {
  if (!enabled)
    return artworks.filter((item) => optionalProductLabelKind(item) !== kind);
  if (hasOptionalProductLabel(artworks, kind)) return artworks;
  const kg = Number(capacity.replace(",", "."));
  if (kind === "capacity" && (!Number.isFinite(kg) || kg <= 0 || kg > 30))
    return artworks;
  const text = kind === "new-model" ? "MODEL I RI" : `${kg} kg`;
  const x = kind === "new-model" ? 8 : 67,
    y = 16;
  const width = kind === "new-model" ? 45 : 25,
    height = 11;
  return [
    ...artworks,
    {
      id: `${prefix}${kind}:shape`,
      type: "shape",
      label: `${text} · background`,
      fill: "#ffffff",
      color: "#ffffff",
      relativeTo: "product",
      x,
      y,
      width,
      height,
      zIndex: 18,
    },
    {
      id: `${prefix}${kind}:text`,
      type: "text",
      layoutRole: "banner",
      textVerticalAlign: "center",
      padding: 0,
      label: text,
      text,
      color: "#000000",
      fontFamily: "Gotham",
      fontWeight: 700,
      fontSize: kind === "new-model" ? 2 : 2.5,
      textAlign: "center",
      relativeTo: "product",
      x,
      y: y + 2,
      width,
      height: 7,
      zIndex: 19,
    },
  ];
}
