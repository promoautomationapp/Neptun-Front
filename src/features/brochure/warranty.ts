import type { Product } from "../../domain/models";
import {
  catalogDetailFacts,
  detailPlainText,
  savedDetailEntries,
} from "./detailFacts";

export function isWarrantyDetail(key: unknown, value: unknown) {
  return /garanc|warrant|guarantee/i.test(
    `${detailPlainText(key)} ${detailPlainText(value)}`,
  );
}

export function warrantyDuration(value: unknown) {
  const text = String(value ?? "")
    .trim()
    .replace(/^(?:garanc\w*|warranty|guarantee)\s*:\s*/i, "");
  // Numeric values in the dedicated warranty field mean years, as in the
  // workbook's “Vitet e Garancionit” column.
  const match = (/^\d+$/.test(text) ? `${text} years` : text).match(
    /^(\d+(?:[.,]\d+)?)\s*(muaj|months?|vit(?:e)?|vjet|years?)(?:\s*(?:garanc\w*|warranty|guarantee))?$/i,
  );
  if (!match) return null;
  const amount = Number((match[1] ?? "").replace(",", "."));
  if (!Number.isInteger(amount) || amount <= 0) return null;
  const months = /^(vit|vjet|year)/i.test(match[2] ?? "")
    ? amount * 12
    : amount;
  if (months % 12 === 0) {
    const count = months / 12;
    return { count, unit: count === 1 ? "VIT" : "VITE", months };
  }
  return { count: months, unit: "MUAJ", months };
}

/** Excel imports may carry the warranty among detail rows rather than in the
 * catalog's warranty field. Extract one source-backed value before laying out
 * the detail strip, keeping its original source row available in the editor. */
export function productWarranty(product: Partial<Product>) {
  if (product.hideWarranty || product.detailBlockPlacements?.__warranty?.hidden)
    return null;
  const explicit = warrantyDuration(product.warranty);
  if (explicit) return explicit;
  const facts = [
    ...(savedDetailEntries(product) || []),
    ...catalogDetailFacts(product).map(({ key, value }) => [key, value]),
    ...Object.entries(product.excelSource?.cells || {}),
  ];
  for (const [key, text] of facts) {
    if (
      !isWarrantyDetail(key, text) ||
      product.detailBlockPlacements?.[String(key)]?.hidden
    )
      continue;
    const plain = detailPlainText(text);
    const duration =
      warrantyDuration(
        /^\d+$/.test(plain) && /muaj|month/i.test(String(key))
          ? `${plain} months`
          : plain,
      ) ||
      warrantyDuration(
        plain.match(/\b\d+\s*(?:muaj|months?|vit(?:e)?|vjet|years?)\b/i)?.[0],
      );
    if (duration) return duration;
  }
  return null;
}

export function warrantyText(value: unknown, language = "sq") {
  const duration = warrantyDuration(value);
  if (!duration) return "";
  if (language === "en") {
    const years = duration.months % 12 === 0;
    return `${duration.count} ${years ? (duration.count === 1 ? "year" : "years") : duration.count === 1 ? "month" : "months"}`;
  }
  return `${duration.count} ${duration.unit.toLowerCase()}`;
}
