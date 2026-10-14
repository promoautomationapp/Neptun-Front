import type { Product } from "../../domain/models";
import { normalize, parsePrice } from "./utils";
import {
  catalogByCode,
  importCode,
  resolveOfferProduct,
} from "./productBundles";
import {
  groupImportRows,
  inferSetColumn,
  resolveSetMembers,
  setOfferProduct,
  sharedSetPrice,
} from "./importRowGroups";
import type { ImportRow } from "./importRowGroups";
import { resolveExcelOffer } from "./excelProducts";
import type { ExcelProductColumns } from "./excelProducts";
export { catalogByCode, importCode } from "./productBundles";

export interface ImportSheet {
  name: string;
  data: readonly ImportRow[];
  startRow?: number;
}
export interface ImportTable {
  sheetName: string;
  headers: string[];
  rows: readonly ImportRow[];
  headerIndex: number;
  rowOffset: number;
  codeCol: number;
  priceCol: number;
  setCol: number;
  matchedCount: number;
  validPriceCount: number;
  score: number;
}
interface ImportIssue {
  row: number;
  code: string;
  reason: string;
}
interface MatchedOffer {
  row: number;
  code: string;
  set?: boolean;
  product: Product | null;
}

function headerScore(header: unknown, kind: string) {
  const text = normalize(String(header ?? "")).replace(/[\s_-]+/g, " ");
  if (kind === "code") {
    if (
      /(^|\b)(product code|item code|article code|artikull|kodi|sku|barcode|bar code|ean)(\b|$)/.test(
        text,
      )
    )
      return 60;
    if (/(^|\b)(code|id)(\b|$)/.test(text)) return 35;
    return 0;
  }
  if (
    /(regular|original|old|rr?egullt|normal|catalog|list price|retail|rrp)/.test(
      text,
    )
  )
    return -90;
  if (
    /(quantity|stock|inventory|amount|count|discount %|zbritje %|percent|margin)/.test(
      text,
    )
  )
    return -90;
  if (
    /(new|sale|offer|promo|campaign|special|akc|aksion|cmimi ri|qmimi ri|çmimi ri|cmim i ri|ofert)/.test(
      text,
    )
  )
    return 80;
  if (/(price|cmim|qmim|çmim)/.test(text)) return 25;
  return 0;
}

function sampleImportRows(rows: readonly ImportRow[]) {
  const occupied = rows.filter(
    (row) =>
      Array.isArray(row) &&
      row.some((cell: unknown) => String(cell ?? "").trim()),
  );
  if (occupied.length <= 300) return occupied;
  const sample = [...occupied.slice(0, 150)];
  const middle = occupied.slice(150, -75);
  const stride = Math.max(1, Math.ceil(middle.length / 75));
  for (let index = 0; index < middle.length; index += stride) {
    const row = middle[index];
    if (row) sample.push(row);
  }
  return [...sample, ...occupied.slice(-75)];
}

export function inferImportColumns(
  headers: readonly unknown[],
  rows: readonly ImportRow[],
  catalog: Product[],
  existingLookup?: Map<string, Product>,
) {
  const lookup = existingLookup || catalogByCode(catalog);
  const sample = sampleImportRows(rows);
  let codeCol = 0;
  let codeScore = -Infinity;
  let codeMatches = 0;
  headers.forEach((header, column) => {
    const matches = sample.filter((row) =>
      Boolean(resolveOfferProduct(row[column], lookup).product),
    ).length;
    const score = headerScore(header, "code") + matches * 100;
    if (score > codeScore) {
      codeScore = score;
      codeCol = column;
      codeMatches = matches;
    }
  });

  let priceCol = Math.min(1, headers.length - 1);
  let priceScore = -Infinity;
  let validPrices = 0;
  let changedPrices = 0;
  headers.forEach((header, column) => {
    if (column === codeCol) return;
    let plausible = 0;
    let changed = 0;
    let valid = 0;
    let numericValues = 0;
    for (const row of sample) {
      if (parsePrice(row[column]) > 0) numericValues += 1;
      const product = resolveOfferProduct(row[codeCol], lookup).product;
      if (!product) continue;
      const price = parsePrice(row[column]);
      if (!(price > 0)) continue;
      if (
        price >= Number(product.regular) * 0.05 &&
        price <= Number(product.regular) * 2.5
      ) {
        plausible += 1;
        valid += 1;
        if (price !== Number(product.regular)) changed += 1;
      }
    }
    const score =
      (valid
        ? headerScore(header, "price")
        : codeMatches === 0 && numericValues
          ? headerScore(header, "price") + Math.min(25, numericValues)
          : 0) +
      plausible * 35 +
      changed * 14 +
      valid * 100;
    if (score > priceScore) {
      priceScore = score;
      priceCol = column;
      validPrices = valid;
      changedPrices = changed;
    }
  });
  return {
    codeCol,
    priceCol,
    setCol: inferSetColumn(headers, [codeCol, priceCol]),
    codeMatches,
    validPrices,
    changedPrices,
    score: codeScore + priceScore,
  };
}

export function selectImportTable(
  sheets: readonly ImportSheet[],
  catalog: Product[],
  options: { sheetName?: string; headerIndex?: number } = {},
): ImportTable | null {
  let best: ImportTable | null = null;
  const lookup = catalogByCode(catalog);
  for (const sheet of sheets) {
    if (options.sheetName && sheet.name !== options.sheetName) continue;
    const data = Array.isArray(sheet.data) ? sheet.data : [];
    if (
      !data.some(
        (row) =>
          Array.isArray(row) &&
          row.some((cell: unknown) => String(cell ?? "").trim()),
      )
    )
      continue;
    const maxColumns = Math.max(
      0,
      ...data.slice(0, 250).map((row) => (Array.isArray(row) ? row.length : 0)),
    );
    if (maxColumns < 2) continue;
    const possibleHeaders =
      options.headerIndex === undefined
        ? [
            -1,
            ...data.slice(0, 120).flatMap((row, index) => {
              if (
                !Array.isArray(row) ||
                !row.some((cell: unknown) => String(cell ?? "").trim())
              )
                return [];
              const looksLikeHeader = row.some(
                (cell: unknown) =>
                  headerScore(cell, "code") > 0 ||
                  headerScore(cell, "price") > 0,
              );
              return index < 12 || looksLikeHeader ? [index] : [];
            }),
          ]
        : [options.headerIndex];
    for (const headerIndex of possibleHeaders) {
      if (headerIndex >= data.length - 1) continue;
      const headers =
        headerIndex < 0
          ? Array.from(
              { length: maxColumns },
              (_, index) => `Column ${index + 1}`,
            )
          : Array.from(
              { length: maxColumns },
              (_, index) =>
                String(data[headerIndex]?.[index] ?? "").trim() ||
                `Column ${index + 1}`,
            );
      const rows = data.slice(headerIndex + 1);
      if (headers.length < 2 || !rows.length) continue;
      const inferred = inferImportColumns(headers, rows, catalog, lookup);
      const namedHeader =
        headerIndex >= 0 &&
        (headerScore(headers[inferred.codeCol], "code") > 0 ||
          headerScore(headers[inferred.priceCol], "price") > 0);
      const brochurePositionColumn = headers.findIndex((value) =>
        /brochure position|leaflet position|pozicioni|renditja/i.test(
          String(value),
        ),
      );
      const brochureRows =
        brochurePositionColumn < 0
          ? 0
          : rows.filter((row) =>
              /^\d+[.,]\d+$/.test(
                String(row?.[brochurePositionColumn] ?? "").trim(),
              ),
            ).length;
      const score =
        inferred.codeMatches * 100 +
        inferred.validPrices * 50 +
        inferred.changedPrices * 10 +
        brochureRows * 8 +
        (namedHeader ? 40 : 0) -
        Math.max(0, headerIndex) / 10;
      if (!best || score > best.score)
        best = {
          sheetName: sheet.name,
          headers,
          rows,
          headerIndex,
          rowOffset: (sheet.startRow || 0) + headerIndex + 2,
          codeCol: inferred.codeCol,
          priceCol: inferred.priceCol,
          setCol: inferred.setCol,
          matchedCount: inferred.codeMatches,
          validPriceCount: inferred.validPrices,
          score,
        };
    }
  }
  return best;
}

export function analyzeImportRows(
  rows: readonly ImportRow[],
  codeCol: number,
  priceCol: number,
  catalog: Product[],
  rowOffset = 2,
  regularCol = -1,
  setCol = -1,
  excelColumns: ExcelProductColumns = {},
) {
  const lookup = catalogByCode(catalog);
  const brandNames = new Set(
    catalog.map((product) => normalize(product.brand || "")).filter(Boolean),
  );
  const matched = new Map<string, MatchedOffer>();
  const skipped: ImportIssue[] = [];
  let ignored = 0;
  groupImportRows(rows, setCol).forEach((group) => {
    const first = group.sources[0];
    if (!first) return;
    const { row, index } = first;
    const rowNumber = rowOffset + index;
    if (group.set) {
      const resolved = resolveSetMembers(
        group,
        codeCol,
        lookup,
        rowOffset,
        (source, code) =>
          resolveExcelOffer(
            code,
            source.row,
            lookup,
            { ...excelColumns, codeCol, priceCol, regularCol: -1, setCol },
            rowOffset + source.index,
          ),
      );
      const sale = sharedSetPrice(group, priceCol, rowOffset);
      const hasRegular =
        regularCol >= 0 &&
        group.sources.some(({ row }) => String(row[regularCol] ?? "").trim());
      const regular = hasRegular
        ? sharedSetPrice(group, regularCol, rowOffset, "regular")
        : null;
      const reason = resolved.error || sale.error || regular?.error;
      const skipSet = (message: string) =>
        group.sources.forEach(({ row, index }) =>
          skipped.push({
            row: rowOffset + index,
            code: String(row[codeCol] ?? "").trim() || "—",
            reason: message,
          }),
        );
      if (reason) {
        skipSet(reason);
        return;
      }
      const product = setOfferProduct(
        resolved.members,
        rowNumber,
        group.sources.map(({ index }) => rowOffset + index),
      );
      if (regular?.value) product.regular = regular.value;
      if (product.catalogMissing && !(Number(product.regular) > 0))
        product.regular = null;
      if (!(Number(product.regular) > 0) && !product.catalogMissing) {
        skipSet("Invalid regular catalog price for Set");
        return;
      }
      matched.set(product.code, {
        row: rowNumber,
        code: product.code,
        set: true,
        product: {
          ...product,
          sale: String(sale.value),
          source: "import",
          confirmedAboveRegular: false,
        },
      });
      return;
    }
    const code = String(row[codeCol] ?? "").trim();
    const saleText = String(row[priceCol] ?? "").trim();
    if (!code) {
      if (parsePrice(saleText) > 0)
        skipped.push({ row: rowNumber, code: "—", reason: "Missing code" });
      else ignored += 1;
      return;
    }
    const resolved = resolveExcelOffer(
      code,
      row,
      lookup,
      { ...excelColumns, codeCol, priceCol, regularCol, setCol },
      rowNumber,
    );
    const isKnownCode = Boolean(lookup.get(importCode(code)));
    if (
      !isKnownCode &&
      (brandNames.has(normalize(code)) ||
        /^(?:brand|marka|brend|subtotal|total|grand total)$/i.test(code))
    ) {
      ignored += 1;
      return;
    }
    if (!isKnownCode && !saleText) {
      ignored += 1;
      return;
    }
    if (
      /^(?:sku|code|kodi|barcode|product code|item code|artikull)$/i.test(code)
    ) {
      ignored += 1;
      return;
    }
    const product = resolved.product && {
      ...resolved.product,
      ...(resolved.bundle && parsePrice(row[regularCol]) > 0
        ? { regular: parsePrice(row[regularCol]) }
        : {}),
    };
    if (!product)
      return skipped.push({
        row: rowNumber,
        code,
        reason: resolved.bundle
          ? `Bundle codes not found in catalog: ${resolved.missingCodes.join(", ")}`
          : "Code not found in catalog",
      });
    if (!(Number(product.regular) > 0) && !product.catalogMissing)
      return skipped.push({
        row: rowNumber,
        code,
        reason: "Invalid regular catalog price",
      });
    const sale = parsePrice(saleText);
    if (!Number.isFinite(sale) || sale <= 0)
      return skipped.push({
        row: rowNumber,
        code,
        reason: "Invalid sale price",
      });
    if (matched.has(product.code))
      skipped.push({
        row: rowNumber,
        code,
        reason: "Duplicate code; latest price used",
      });
    const catalogProduct = lookup.get(importCode(code));
    const changedFacts =
      catalogProduct &&
      (
        [
          "name",
          "brand",
          "category",
          "warranty",
          "specs",
          "brochureDetails",
          "regular",
        ] as const
      ).some(
        (key) =>
          JSON.stringify(catalogProduct[key]) !== JSON.stringify(product[key]),
      );
    matched.set(product.code, {
      row: rowNumber,
      code,
      product:
        !resolved.bundle &&
        !changedFacts &&
        !product.catalogMissing &&
        sale === Number(product.regular)
          ? null
          : {
              ...product,
              sale: String(sale),
              source: "import",
              confirmedAboveRegular: false,
            },
    });
  });
  const final = [...matched.values()];
  const changed = final.flatMap((entry) =>
    entry.product ? [entry.product] : [],
  );
  return {
    discounted: final.flatMap(({ product, set }) =>
      product &&
      (Number(product.sale) < Number(product.regular) ||
        ((set || product.bundleProducts || product.excelSource) &&
          Number(product.sale) === Number(product.regular)))
        ? [product]
        : [],
    ),
    higher: changed.filter(
      (product: Product) =>
        Number(product.regular) > 0 &&
        Number(product.sale) > Number(product.regular),
    ),
    withoutRegular: changed.filter((product) => !(Number(product.regular) > 0)),
    missingCatalog: changed.filter((product) => product.catalogMissing),
    unchanged: final
      .filter((entry) => !entry.product)
      .map(({ row, code }) => ({ row, code })),
    skipped,
    ignored,
  };
}
