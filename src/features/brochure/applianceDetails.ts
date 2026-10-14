import type { Product } from "../../domain/models";
import {
  catalogDetailFacts,
  isDeniedDetail,
  normalizedDetail,
  savedDetailEntries,
  type CatalogDetailFact,
  type DetailEntry,
} from "./detailFacts";

export function isWashingMachine(product: Partial<Product>): boolean {
  const text = normalizedDetail(
    `${product.category || ""} ${product.subcategory || ""} ${product.name || ""}`,
  );
  return (
    /\b(?:rroba?larese|lavatri[çc]e|washing\s+machine|washer)\b/.test(text) &&
    !/\b(?:aksesore?|accessor(?:y|ies)|detergjent|detergent|mbulese|cover|hose|tub)\b/.test(
      text,
    )
  );
}

type WasherKind = "capacity" | "spin" | "programs" | "inverter" | "technology";

function washerValue(kind: WasherKind, fact: CatalogDetailFact): string | null {
  const key = normalizedDetail(fact.key),
    value = fact.value,
    all = normalizedDetail(`${fact.key} ${value}`);
  if (!value || isDeniedDetail(value)) return null;
  if (
    kind === "capacity" &&
    (/kapacitet|capacity|mbushje|load/.test(key) || !key)
  ) {
    return value.match(/\b\d+(?:[.,]\d+)?\s*KG\b/i)?.[0] || null;
  }
  if (kind === "spin" && /rrotull|centrifug|spin|rpm/.test(all)) {
    return (
      value.match(/\b\d{3,4}(?=\s*(?:rpm\b|r\/min\b|rrot|r\/m\b|$))/i)?.[0] ||
      null
    );
  }
  if (kind === "programs" && /program/.test(all))
    return value.match(/\b\d+\b/)?.[0] || null;
  if (kind === "inverter" && /\binverter\b/.test(all)) {
    if (/^(?:yes|po|true|1)$/i.test(value.trim())) return fact.key;
    return value;
  }
  if (kind === "technology") {
    if (/\benergy\s*spin\b/i.test(value)) return value;
    if (/teknolog|technology/.test(key) && !/\binverter\b/.test(all))
      return value;
  }
  return null;
}

// The reference washer strip is factual capacity, spin speed, programs, motor,
// then any supplied extra technology. Warranty is rendered by the card itself.
export function applianceDetailEntries(
  product: Partial<Product> = {},
): DetailEntry[] {
  const saved = savedDetailEntries(product);
  if (saved) return saved;
  const specs = Object.entries(product.specs || {});
  if (!isWashingMachine(product)) return specs;
  const source = catalogDetailFacts(product),
    consumed = new Set<number>();
  const result: DetailEntry[] = [];
  const kinds: [WasherKind, string][] = [
    ["capacity", "Kapaciteti"],
    ["spin", "RROTULLIME"],
    ["programs", "PROGRAME"],
    ["inverter", "Motori"],
    ["technology", "TEKNOLOGJI:"],
  ];
  for (const [kind, label] of kinds) {
    const matches = source
      .map((fact) => ({ fact, value: washerValue(kind, fact) }))
      .filter((entry) => entry.value !== null);
    const first = matches[0];
    if (!first?.value) continue;
    result.push([label, first.value]);
    for (const { fact, value } of matches)
      if (
        fact.specIndex != null &&
        normalizedDetail(value) === normalizedDetail(first.value)
      )
        consumed.add(fact.specIndex);
  }
  for (const [index, entry] of specs.entries()) {
    if (!consumed.has(index) && entry[1] && !/garanc|warranty/i.test(entry[0]))
      result.push(entry);
  }
  return result;
}
