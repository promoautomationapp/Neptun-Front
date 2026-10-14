import type { Product } from "../../domain/models";
import type { ImportRow } from "./importRowGroups";
import { groupImportedPhoneDetails } from "./mobileDetails";
import {
  createBundleOffer,
  importCode,
  resolveOfferProduct,
} from "./productBundles";
import { normalize, parsePrice } from "./utils";

/** Optional mappings for ordinary price imports as well as positioned brochure imports. */
export interface ExcelProductColumns {
  nameCol?: number;
  detailsCol?: number;
  brandCol?: number;
  categoryCol?: number;
  warrantyCol?: number;
  imageCol?: number;
  headers?: readonly unknown[];
  codeCol?: number;
  priceCol?: number;
  regularCol?: number;
  setCol?: number;
  positionCol?: number;
  colorCol?: number;
}

export function inferExcelProductColumns(headers: readonly unknown[]) {
  const find = (pattern: RegExp) =>
    headers.findIndex((value) =>
      pattern.test(
        normalize(String(value ?? ""))
          .replace(/[\s_-]+/g, " ")
          .trim(),
      ),
    );
  return {
    nameCol: find(
      /^(?:description|product name|item name|name|emri|emri i produktit|pershkrimi|artikull)$/,
    ),
    detailsCol: find(
      /technical specifications|specifications|specifika|detaj|details/,
    ),
    brandCol: find(/^(?:brand|brands|brendi|marka)$/),
    categoryCol: find(/^(?:category|category path|kategoria|kategori)$/),
    warrantyCol: find(/garanci|warranty/),
    imageCol: find(/^(?:image|image url|photo|photo url|foto|fotografia)$/),
    headers,
  };
}

function cell(row: ImportRow, column: number | undefined) {
  return column !== undefined && column >= 0
    ? String(row[column] ?? "").trim()
    : "";
}

export function splitExcelDetails(value: unknown) {
  const source = String(value ?? "");
  const separated =
    !/[\r\n]/.test(source) && source.split(",").length >= 4
      ? source.replace(/,\s*/g, "\n")
      : source;
  return separated
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[•*\-–]+|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

/** Keeps the worksheet's facts without inferring or inventing specifications. */
export function excelRowProduct(
  row: ImportRow,
  code: string,
  catalogProduct: Product | null,
  columns: ExcelProductColumns,
  rowNumber: number,
): Product | null {
  if (!code && !catalogProduct) return null;
  const name = cell(row, columns.nameCol);
  const details = splitExcelDetails(cell(row, columns.detailsCol));
  const excluded = new Set(
    Object.entries(columns).flatMap(([key, value]) =>
      key.endsWith("Col") && typeof value === "number" && value >= 0
        ? [value]
        : [],
    ),
  );
  const facts: Record<string, string> = {};
  const cells: Record<string, string> = {};
  const headings =
    columns.headers || row.map((_, index) => `Column ${index + 1}`);
  headings.forEach((heading, index) => {
    const value = String(row[index] ?? "").trim();
    const key = String(heading ?? "").trim() || `Column ${index + 1}`;
    if (value) cells[key] = value;
    if (
      value &&
      !excluded.has(index) &&
      !/^Column \d+$/i.test(key) &&
      !/price|cmim|qmim|çmim|discount|zbritje|kurs|quantity|stock|inventory|subtotal|total|barcode|sku|position|pozicion/i.test(
        normalize(key),
      )
    )
      facts[key] = value;
  });
  for (const line of details) {
    const match = line.match(/^([^:]{1,80}):\s*(.+)$/);
    if (match?.[1] && match[2]) facts[match[1].trim()] = match[2].trim();
  }
  const brand = cell(row, columns.brandCol);
  const category = cell(row, columns.categoryCol);
  const warranty = cell(row, columns.warrantyCol);
  const image = cell(row, columns.imageCol);
  const regular = parsePrice(cell(row, columns.regularCol));
  const product: Product = {
    ...(catalogProduct || {}),
    code: catalogProduct?.code || code,
    name: name || catalogProduct?.name || code,
    ...(brand ? { brand } : {}),
    ...(category ? { category } : {}),
    ...(warranty ? { warranty } : {}),
    ...(image && /^https:\/\//i.test(image) ? { image } : {}),
    regular: regular > 0 ? regular : (catalogProduct?.regular ?? null),
    ...(Object.keys(facts).length
      ? { specs: { ...catalogProduct?.specs, ...facts } }
      : {}),
    excelSource: { row: rowNumber, cells },
    ...(!catalogProduct
      ? { catalogMissing: true, missingCatalogCodes: [code] }
      : {}),
  };
  if (details.length)
    product.brochureDetails = groupImportedPhoneDetails(product, details);
  return product;
}

/** A multi-code cell stays one offer; missing members use the same Excel row as evidence. */
export function resolveExcelOffer(
  code: string,
  row: ImportRow,
  lookup: Map<string, Product>,
  columns: ExcelProductColumns,
  rowNumber: number,
): ReturnType<typeof resolveOfferProduct> {
  const resolved = resolveOfferProduct(code, lookup);
  if (!resolved.bundle)
    return {
      ...resolved,
      product: excelRowProduct(row, code, resolved.product, columns, rowNumber),
    };
  const members = resolved.codes.map((memberCode) => {
    const catalogProduct = lookup.get(importCode(memberCode)) || null;
    // The row's regular price describes the entire offer, never each member.
    return excelRowProduct(
      row,
      memberCode,
      catalogProduct,
      {
        ...columns,
        regularCol: -1,
        ...(catalogProduct ? { nameCol: -1 } : {}),
      },
      rowNumber,
    );
  });
  if (members.some((member) => !member)) return resolved;
  const product = createBundleOffer(
    members.filter((member): member is Product => Boolean(member)),
  );
  const regular = parsePrice(cell(row, columns.regularCol));
  if (regular > 0) product.regular = regular;
  else if (product.catalogMissing && !(Number(product.regular) > 0))
    product.regular = null;
  const name = cell(row, columns.nameCol);
  if (name) product.name = name;
  const source = members.find((member) => member?.excelSource)?.excelSource;
  if (source) product.excelSource = source;
  return { ...resolved, product, missingCodes: [] };
}
