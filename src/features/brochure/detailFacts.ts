import type { Product } from "../../domain/models";

export type DetailEntry = [string, string];

export interface CatalogDetailFact {
  key: string;
  value: string;
  specIndex?: number;
}

export interface StructuredDetailRow {
  key: string;
  text: string;
}

export function isStructuredDetailRow(
  value: unknown,
): value is StructuredDetailRow {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "key" in value &&
    typeof value.key === "string" &&
    "text" in value &&
    typeof value.text === "string",
  );
}

export interface SavedDetailSource {
  brochureDetails?: readonly unknown[];
  autoSpecsDisabled?: boolean;
  specs?: Record<string, string>;
}

const entities: Record<string, string> = {
  euml: "ë",
  Euml: "Ë",
  ccedil: "ç",
  Ccedil: "Ç",
  deg: "°",
  sup3: "³",
  nbsp: " ",
  amp: "&",
  minus: "−",
  ndash: "–",
  mdash: "—",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
};

export function detailPlainText(value: unknown): string {
  return String(value ?? "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\b[^>]*>|<\/(?:p|li|div|tr|ul)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(
      /&(#x[\da-f]+|#\d+|[a-z][a-z\d]*);/gi,
      (whole: string, name: string) => {
        if (name[0] !== "#") return entities[name] ?? whole;
        const code =
          name[1]?.toLowerCase() === "x"
            ? parseInt(name.slice(2), 16)
            : Number(name.slice(1));
        return Number.isInteger(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : whole;
      },
    )
    .replace(/[\t\r ]+/g, " ")
    .trim();
}

export const normalizedDetail = (value: unknown): string =>
  detailPlainText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function catalogDetailFacts(
  product: Partial<Product>,
): CatalogDetailFact[] {
  const specs = Object.entries(product.specs || {}).map(
    ([key, value], specIndex) => ({
      key: detailPlainText(key).replace(/^\*\s*/, ""),
      value: detailPlainText(value),
      specIndex,
    }),
  );
  const description = detailPlainText(product.description)
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[*•·]\s*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const colon = line.indexOf(":");
      return colon < 0
        ? { key: "", value: line }
        : {
            key: line.slice(0, colon).trim(),
            value: line.slice(colon + 1).trim(),
          };
    });
  return [...specs, ...description];
}

export function isDeniedDetail(value: unknown): boolean {
  return (
    /^(?:no|not|without|pa|jo|false|0|none|n\/a|nuk\s+(?:ka|mbeshtet\w*))\b/i.test(
      normalizedDetail(value),
    ) ||
    /\b(?:optional|opsionale?|not\s+(?:included|supported)|nuk\s+(?:ka|mbeshtet\w*))\b/i.test(
      normalizedDetail(value),
    )
  );
}

export function savedDetailEntries(
  product: SavedDetailSource,
): DetailEntry[] | undefined {
  if (Array.isArray(product.brochureDetails))
    return product.brochureDetails.map((line: unknown, index): DetailEntry => {
      if (line && typeof line === "object" && !Array.isArray(line)) {
        const row = line as Record<string, unknown>;
        const key =
          typeof row.key === "string" || typeof row.key === "number"
            ? String(row.key)
            : String(index);
        if (typeof row.text === "string") return [key, row.text];
        if (typeof row.value === "string") return [key, row.value];
        return [key, JSON.stringify(row)];
      }
      return [String(index), String(line ?? "")];
    });
  if (product.autoSpecsDisabled) return Object.entries(product.specs || {});
  return undefined;
}
