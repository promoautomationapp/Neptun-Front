import type { Product } from "../../domain/models";
import {
  createBundleOffer,
  importCode,
  resolveOfferProduct,
} from "./productBundles";
import { normalize, parsePrice } from "./utils";

export type ImportRow = readonly unknown[];
export interface ImportSourceRow {
  row: ImportRow;
  index: number;
}
export interface ImportRowGroup {
  set: boolean;
  sources: ImportSourceRow[];
}

export function inferSetColumn(
  headers: readonly unknown[],
  excluded: readonly number[] = [],
) {
  return headers.findIndex(
    (value, index) =>
      !excluded.includes(index) &&
      /^(?:pulla|set|set group|bundle group)$/.test(
        normalize(String(value ?? "")).replace(/[\s_-]+/g, " "),
      ),
  );
}

/** Only consecutive marked rows belong together. Blank and unmarked rows are barriers. */
export function groupImportRows(
  rows: readonly unknown[],
  setCol = -1,
): ImportRowGroup[] {
  const groups: ImportRowGroup[] = [];
  for (const [index, input] of rows.entries()) {
    const row: ImportRow = Array.isArray(input) ? input : [];
    const set = setCol >= 0 && normalize(String(row[setCol] ?? "")) === "set";
    const previous = groups.at(-1);
    if (set && previous?.set) previous.sources.push({ row, index });
    else groups.push({ set, sources: [{ row, index }] });
  }
  return groups;
}

/** Shared offer prices are never added together; disagreeing populated cells need review. */
export function sharedSetPrice(
  group: ImportRowGroup,
  column: number,
  rowOffset: number,
  label = "sale",
) {
  const populated = group.sources.filter(({ row }) =>
    String(row[column] ?? "").trim(),
  );
  const values = populated.map(({ row, index }) => ({
    value: parsePrice(row[column]),
    row: rowOffset + index,
  }));
  const invalid = values.find(
    ({ value }) => !Number.isFinite(value) || value <= 0,
  );
  if (invalid)
    return {
      value: null,
      error: `Invalid shared Set ${label} price at row ${invalid.row}`,
    };
  const first = values[0];
  if (!first)
    return { value: null, error: `Missing shared Set ${label} price` };
  const different = values.find(
    ({ value }) => Math.abs(value - first.value) > 0.000001,
  );
  if (different)
    return {
      value: null,
      error: `Conflicting shared Set ${label} prices at rows ${values.map(({ row }) => row).join(", ")}`,
    };
  return { value: first.value, error: null };
}

export function resolveSetMembers(
  group: ImportRowGroup,
  codeCol: number,
  lookup: Map<string, Product>,
  rowOffset: number,
  resolveSource?: (
    source: ImportSourceRow,
    code: string,
  ) => ReturnType<typeof resolveOfferProduct>,
) {
  const members: Product[] = [];
  const seen = new Set<string>();
  const resolvedRows: Array<{
    source: ImportSourceRow;
    product: Product;
    bundle: boolean;
  }> = [];
  const issues: string[] = [];
  for (const source of group.sources) {
    const code = String(source.row[codeCol] ?? "").trim();
    const row = rowOffset + source.index;
    if (!code) {
      issues.push(`Missing Set product code at row ${row}`);
      continue;
    }
    const resolved =
      resolveSource?.(source, code) || resolveOfferProduct(code, lookup);
    if (!resolved.product) {
      issues.push(
        `Set codes not found in catalog at row ${row}: ${resolved.missingCodes.join(", ") || code}`,
      );
      continue;
    }
    resolvedRows.push({
      source,
      product: resolved.product,
      bundle: resolved.bundle,
    });
    const products = resolved.bundle
      ? resolved.product.bundleProducts || []
      : [resolved.product];
    for (const product of products) {
      const key = importCode(product.code);
      if (seen.has(key))
        issues.push(`Repeated Set product code at row ${row}: ${product.code}`);
      else {
        seen.add(key);
        members.push(product);
      }
    }
  }
  return {
    members,
    resolvedRows,
    error: issues.length ? issues.join("; ") : null,
  };
}

/** Set run identity preserves repeated offers, including later ordinary multi-code rows. */
export function setOfferProduct(
  members: Product[],
  firstRow: number,
  sourceRows = [firstRow],
): Product {
  const first = members[0];
  if (!first) throw new Error("A Set needs at least one resolved product");
  const product =
    members.length > 1 ? createBundleOffer(members) : structuredClone(first);
  return {
    ...product,
    code: `${product.code} [Set row ${firstRow}]`,
    setSourceRows: [...sourceRows],
  };
}
