import type { Product } from "../../domain/models";
import { isAirConditioner } from "./productArtwork";
import {
  catalogDetailFacts,
  detailPlainText,
  isDeniedDetail,
  normalizedDetail,
  savedDetailEntries,
  type CatalogDetailFact,
  type DetailEntry,
} from "./detailFacts";

type ConditionerFactKind =
  "btu" | "energy" | "temperature" | "gas" | "airflow" | "technology";

export function detailEnergyClasses(value: string): string[] {
  return [...value.matchAll(/\b[A-G](?:\s*\+){0,3}(?![\w+])/gi)].map(
    ([match]) => match.replace(/\s+/g, "").toUpperCase(),
  );
}

function valueFor(
  kind: ConditionerFactKind,
  fact: CatalogDetailFact,
): string | null {
  const key = normalizedDetail(fact.key),
    value = fact.value;
  if (!value || isDeniedDetail(value)) return null;
  if (kind === "btu") {
    const match = value.match(/\b(\d[\d., ]*)\s*BTU\b/i);
    if (match) return `${match[1]?.trim()} BTU`;
    return /\bbtu\b/.test(key) && /^\d[\d., ]*$/.test(value) ? value : null;
  }
  if (kind === "energy") {
    if (
      !/energ|efficien/.test(key) &&
      !/klas\w*\s+(?:e\s+)?energ|energy\s*(?:class|rating|efficien)/i.test(
        normalizedDetail(value),
      )
    )
      return null;
    const classes = detailEnergyClasses(value);
    return classes.length ? classes.join(" / ") : null;
  }
  if (kind === "temperature") {
    if (!/operativ|operating|temperatur|working\s*range/.test(key)) return null;
    return /\d/.test(value) && /°\s*[CF]|celsius|fahrenheit/i.test(value)
      ? value
      : null;
  }
  if (kind === "gas") {
    if (
      !/gas|gaz|refriger|ftohes/.test(key) &&
      !/\b(?:gas|gaz|refrigerant)\b/.test(normalizedDetail(value))
    )
      return null;
    return (
      value
        .match(/\bR\s*-?\s*\d{2,4}[a-z]?\b/i)?.[0]
        .replace(/[\s-]/g, "")
        .toUpperCase() || null
    );
  }
  if (kind === "airflow") {
    if (!/qarkullim|air\s*flow|airflow|rrjedh.*ajrit/.test(key)) return null;
    return /\d/.test(value) ? value : null;
  }
  if (kind === "technology" && /teknolog|technology/.test(key)) return value;
  return null;
}

function technologyFallback(source: CatalogDetailFact[]): string | null {
  const inverter = source.filter((fact) =>
    /\binverter\b/i.test(`${fact.key} ${fact.value}`),
  );
  if (
    inverter.some(
      (fact) =>
        isDeniedDetail(fact.value) ||
        /\b(?:no|without|pa|non)\s*[- ]?inverter\b/i.test(
          `${fact.key} ${fact.value}`,
        ),
    )
  )
    return null;
  return inverter.length ? "INVERTER" : null;
}

// Catalog facts enrich defaults only; saved detail lists and disabled auto-specs
// remain authoritative, including an intentionally empty list.
export function conditionerDetailEntries(
  product: Partial<Product> = {},
): DetailEntry[] {
  const saved = savedDetailEntries(product);
  if (saved) return saved;
  const specs = Object.entries(product.specs || {});
  if (!isAirConditioner(product)) return specs;
  const source = catalogDetailFacts(product),
    consumed = new Set<number>();
  const result: DetailEntry[] = [];
  const kinds: [ConditionerFactKind, string][] = [
    ["btu", "BTU"],
    ["energy", "Klasa energjisë"],
    ["temperature", "Niveli operativ"],
    ["gas", "GAS"],
    ["airflow", "Qarkullimi i ajrit"],
    ["technology", "Teknologjia"],
  ];
  for (const [kind, label] of kinds) {
    const matching = source
      .map((fact) => ({ fact, value: valueFor(kind, fact) }))
      .filter(
        (entry): entry is { fact: CatalogDetailFact; value: string } =>
          entry.value !== null,
      );
    const distinct = matching.filter(
      (entry, index) =>
        !matching
          .slice(0, index)
          .some(
            (previous) =>
              normalizedDetail(previous.value) ===
                normalizedDetail(entry.value) &&
              !(
                kind === "energy" &&
                previous.fact.specIndex != null &&
                entry.fact.specIndex != null &&
                normalizedDetail(previous.fact.key) !==
                  normalizedDetail(entry.fact.key)
              ),
          ),
    );
    const energyPair = distinct
      .map((entry) => detailEnergyClasses(entry.value))
      .find((classes) => classes.length > 1);
    const energyValues = energyPair
      ? [
          ...energyPair,
          ...distinct
            .flatMap((entry) => detailEnergyClasses(entry.value))
            .filter((item) => !energyPair.includes(item)),
        ]
      : distinct.flatMap((entry) => detailEnergyClasses(entry.value));
    const value =
      kind === "energy"
        ? energyValues.join(" / ") || null
        : (distinct[0]?.value ??
          (kind === "technology" ? technologyFallback(source) : null));
    if (value === null) continue;
    result.push([label, value]);
    for (const { fact, value: foundValue } of matching) {
      // Only facts actually represented in this box are consumed. A separate
      // technology or feature remains available as its own detail block.
      if (
        fact.specIndex != null &&
        (kind === "energy" ||
          normalizedDetail(foundValue) === normalizedDetail(value))
      )
        consumed.add(fact.specIndex);
    }
    if (kind === "technology" && value === "INVERTER")
      for (const fact of source) {
        if (fact.specIndex != null && /^inverter$/i.test(fact.key))
          consumed.add(fact.specIndex);
      }
  }
  for (const [index, entry] of specs.entries()) {
    if (
      consumed.has(index) ||
      /garanc|warranty/i.test(normalizedDetail(entry[0])) ||
      !detailPlainText(entry[1])
    )
      continue;
    result.push(entry);
  }
  return result;
}

// Caller gates this by the current/orange strip style. Saved fill overrides
// still win in ProductDetailBlock, so changing a fact never resets user styling.
export function defaultFilledDetail(
  product: Partial<Product>,
  key: string,
  value: unknown,
  index: number,
): boolean {
  if (!isAirConditioner(product)) return index === 0;
  const content = `${key} ${detailPlainText(value)}`;
  const energyOnly =
    /^\s*[A-G](?:\s*\+){0,3}(?:\s*[/\n ]\s*[A-G](?:\s*\+){0,3})*\s*$/i.test(
      detailPlainText(value),
    );
  return (
    /\bBTU\b|temperatur|operativ|°\s*C/i.test(content) ||
    ((energyOnly || /energ|efficien/i.test(normalizedDetail(content))) &&
      detailEnergyClasses(String(value)).length > 0)
  );
}
