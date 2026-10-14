import type { Product } from "../../domain/models";
import { catalogByCode, importCode } from "./importAnalysis";
import { normalize, parsePrice } from "./utils";
import { isBundleOffer } from "./productBundles";
import {
  groupImportRows,
  inferSetColumn,
  resolveSetMembers,
  setOfferProduct,
  sharedSetPrice,
} from "./importRowGroups";
import type { ImportRow } from "./importRowGroups";
import { groupImportedPhoneDetails } from "./mobileDetails";
import {
  excelRowProduct,
  inferExcelProductColumns,
  resolveExcelOffer,
  splitExcelDetails,
} from "./excelProducts";
import type { ExcelProductColumns } from "./excelProducts";

export interface BrochureImportColumns extends ExcelProductColumns {
  codeCol: number;
  priceCol: number;
  positionCol: number;
  detailsCol: number;
  nameCol: number;
  colorCol: number;
  regularCol: number;
  brandCol: number;
  setCol?: number;
}
interface BrochurePosition {
  page: number;
  order: number;
  label: string;
}
interface ImportedColor {
  name: string;
  hex: string;
}
interface BrochureEntry {
  row: number;
  position: BrochurePosition | null;
  color: ImportedColor | null;
  sourceRows: number;
  product: Product;
}
interface BrochureIssue {
  row: number;
  code: string;
  name: string;
  reason: string;
}
interface BrochureWarning {
  position?: string;
  row: number;
  code: string;
  name: string;
  message: string;
}

const COLOR_WORDS: [string, string][] = [
  ["space black", "#30343a"],
  ["deep blue", "#1d395b"],
  ["dark blue", "#243f75"],
  ["sky blue", "#8bc5e9"],
  ["light blue", "#9ac9e5"],
  ["gracier blue", "#9bc8df"],
  ["cosmic orange", "#dc7b49"],
  ["light gold", "#d9c7a4"],
  ["pink gold", "#d9ada4"],
  ["mocha brown", "#91705d"],
  ["space grey", "#777c82"],
  ["gaphite grey", "#575d62"],
  ["graphite grey", "#575d62"],
  ["black", "#25292e"],
  ["white", "#f5f5f1"],
  ["silver", "#c9ced1"],
  ["grey", "#8d9398"],
  ["gray", "#8d9398"],
  ["graphite", "#575d62"],
  ["gaphit", "#575d62"],
  ["green", "#4d9c7d"],
  ["blue", "#4f8fc7"],
  ["violet", "#8c77b5"],
  ["red", "#c95051"],
  ["pink", "#e7a8bd"],
  ["beige", "#c9b79d"],
  ["gold", "#ccae65"],
  ["brown", "#806751"],
  ["squad", "#6e7659"],
];

function header(value: unknown) {
  return normalize(String(value ?? ""))
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function inferBrochureColumns(
  headers: readonly unknown[],
  rows: readonly ImportRow[] = [],
  excluded: readonly number[] = [],
) {
  const blocked = new Set(excluded.filter((index) => index >= 0));
  const find = (
    test: (value: string) => boolean,
    predicate: (index: number) => boolean = () => true,
  ) =>
    headers.findIndex(
      (value, index) =>
        !blocked.has(index) && test(header(value)) && predicate(index),
    );
  let positionCol = find((value: string) =>
    /brochure position|leaflet position|page position|pozicioni|renditja/.test(
      value,
    ),
  );
  if (positionCol < 0) {
    const candidates = headers
      .map((value, index) => {
        if (
          blocked.has(index) ||
          /price|cmim|qmim|discount|zbrit|stock|cost|margin|qty|sales|code|sku/i.test(
            header(value),
          )
        )
          return { index, score: 0 };
        return {
          index,
          score: rows.filter((row) => {
            const parsed = parseBrochurePosition(row?.[index]);
            return parsed && parsed.page <= 80 && parsed.order <= 30;
          }).length,
        };
      })
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score);
    const candidate = candidates[0];
    if (candidate && candidate.score >= 4) positionCol = candidate.index;
  }
  const detailsCol = find(
    (value: string) =>
      /technical specifications for the leaflet|technical specifications|product details|specifications|specifika|detaj|^details$/.test(
        value,
      ),
    (index) => index !== positionCol,
  );
  const nameCol = find((value: string) =>
    /^(description|product name|item name|name|emri|emri i produktit|pershkrimi|artikull)$/.test(
      value,
    ),
  );
  const colorCol = find((value: string) =>
    /^(colour|color|ngjyra)$/.test(value),
  );
  const regularCol = find((value: string) =>
    /retail price before promo|regular price|original price|cmimi i rregullt|qmimi i rregullt/.test(
      value,
    ),
  );
  const brandCol = find((value: string) =>
    /^(brands?|brendi|marka)$/.test(value),
  );
  const positionMatches =
    positionCol < 0
      ? 0
      : rows.filter((row) => parseBrochurePosition(row?.[positionCol])).length;
  const setCol = inferSetColumn(headers, excluded);
  return {
    ...inferExcelProductColumns(headers),
    positionCol,
    detailsCol,
    nameCol,
    colorCol,
    regularCol,
    brandCol,
    setCol,
    positionMatches,
  };
}

export function parseBrochurePosition(value: unknown): BrochurePosition | null {
  if (value === null || value === undefined || String(value).trim() === "")
    return null;
  const raw = String(value).trim().replace(",", ".");
  // Excel often serializes 1.1 as 1.1000000000000001. A displayed value
  // with two meaningful digits after the dot is still treated as one slot.
  const clean = /^\d+\.\d{8,}$/.test(raw)
    ? String(Number(Number(raw).toFixed(4)))
    : raw;
  const match = clean.match(/^(\d+)\.(\d+)$/);
  if (!match) return null;
  const page = Number(match[1]);
  const order = Number(match[2]);
  return page >= 1 && page <= 999 && order >= 1 && order <= 999
    ? { page, order, label: `${page}.${order}` }
    : null;
}

export function splitImportedDetails(value: unknown) {
  return splitExcelDetails(value);
}

export function reorderImportedDetails(
  details: string[],
  from: number,
  to: number,
) {
  if (
    !Array.isArray(details) ||
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= details.length ||
    to >= details.length
  )
    return details;
  const next = [...details];
  const moved = next.splice(from, 1)[0];
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

function colorFrom(text: unknown) {
  const source = normalize(String(text ?? ""))
    .replace(/\(demo\)/g, "")
    .trim();
  for (const [name, hex] of COLOR_WORDS) {
    if (new RegExp(`(?:^|\\s)${name}(?:$|\\s)`).test(source))
      return { name, hex };
  }
  return null;
}

function familyName(name: string) {
  let value = normalize(name).replace(/\(demo\)/g, " ");
  for (const [color] of COLOR_WORDS)
    value = value.replace(new RegExp(`(?:^|\\s)${color}(?=$|\\s)`, "g"), " ");
  return value
    .replace(/\b(?=[a-z0-9]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]{10,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function catalogByName(catalog: Product[]) {
  const byName = new Map<string, Product[]>();
  for (const product of catalog) {
    const key = familyName(product.name);
    if (!key) continue;
    const matches = byName.get(key) || [];
    matches.push(product);
    byName.set(key, matches);
  }
  return byName;
}

export function analyzeBrochureRows(
  rows: readonly ImportRow[],
  columns: BrochureImportColumns,
  catalog: Product[],
  rowOffset = 2,
) {
  const codeLookup = catalogByCode(catalog);
  const nameLookup = catalogByName(catalog);
  const entries: BrochureEntry[] = [];
  const skipped: BrochureIssue[] = [];
  const warnings: BrochureWarning[] = [];
  let ignored = 0;
  groupImportRows(rows, columns.setCol ?? -1).forEach((group) => {
    const first = group.sources[0];
    if (!first) return;
    const { row, index } = first;
    const rowNumber = rowOffset + index;
    if (group.set) {
      const resolved = resolveSetMembers(
        group,
        columns.codeCol,
        codeLookup,
        rowOffset,
        (source, code) =>
          resolveExcelOffer(
            code,
            source.row,
            codeLookup,
            { ...columns, regularCol: -1 },
            rowOffset + source.index,
          ),
      );
      const sharedSale = sharedSetPrice(group, columns.priceCol, rowOffset);
      const hasRegular =
        columns.regularCol >= 0 &&
        group.sources.some(({ row }) =>
          String(row[columns.regularCol] ?? "").trim(),
        );
      const sharedRegular = hasRegular
        ? sharedSetPrice(group, columns.regularCol, rowOffset, "regular")
        : null;
      const reason = resolved.error || sharedSale.error || sharedRegular?.error;
      const skipSet = (message: string) =>
        group.sources.forEach(({ row, index }) =>
          skipped.push({
            row: rowOffset + index,
            code: String(row[columns.codeCol] ?? "").trim() || "—",
            name: String(row[columns.nameCol] ?? "").trim(),
            reason: message,
          }),
        );
      if (reason) {
        skipSet(reason);
        return;
      }
      const members = resolved.members.map((member) => {
        const source = resolved.resolvedRows.find(
          ({ product, bundle }) =>
            !bundle && importCode(product.code) === importCode(member.code),
        );
        const imported = source?.source.row;
        const importedName = String(imported?.[columns.nameCol] ?? "").trim();
        const importedProduct = {
          ...member,
          ...(importedName ? { name: importedName } : {}),
        };
        const details =
          columns.detailsCol >= 0
            ? splitImportedDetails(imported?.[columns.detailsCol])
            : [];
        return {
          ...importedProduct,
          ...(details.length
            ? {
                brochureDetails: groupImportedPhoneDetails(
                  importedProduct,
                  details,
                ),
              }
            : {}),
        };
      });
      const product = setOfferProduct(
        members,
        rowNumber,
        group.sources.map(({ index }) => rowOffset + index),
      );
      if (sharedRegular?.value) product.regular = sharedRegular.value;
      if (product.catalogMissing && !(Number(product.regular) > 0))
        product.regular = null;
      if (!(Number(product.regular) > 0) && !product.catalogMissing) {
        skipSet("Invalid regular catalog price for Set");
        return;
      }
      const positions = group.sources.flatMap(({ row, index }) => {
        const position = parseBrochurePosition(row[columns.positionCol]);
        return position ? [{ position, row: rowOffset + index }] : [];
      });
      const position = positions[0]?.position ?? null;
      if (positions.some((entry) => entry.position.label !== position?.label))
        warnings.push({
          position: position?.label,
          row: rowNumber,
          code: product.code,
          name: product.name,
          message: `Set rows have different brochure positions; first position ${position?.label} used.`,
        });
      const details = [
        ...new Set(
          resolved.resolvedRows.flatMap(({ source, product, bundle }) => {
            const imported =
              columns.detailsCol >= 0
                ? splitImportedDetails(source.row[columns.detailsCol])
                : [];
            const importedProduct = members.find(
              (member) => importCode(member.code) === importCode(product.code),
            );
            return !bundle && imported.length
              ? groupImportedPhoneDetails(importedProduct || product, imported)
              : imported;
          }),
        ),
      ];
      entries.push({
        row: rowNumber,
        position,
        color: null,
        sourceRows: group.sources.length,
        product: {
          ...product,
          sale: String(sharedSale.value),
          source: "import",
          confirmedAboveRegular:
            Number(product.regular) > 0 &&
            Number(sharedSale.value) > Number(product.regular),
          ...(position
            ? { brochurePage: position.page, brochureOrder: position.order }
            : {}),
          ...(details.length ? { brochureDetails: details } : {}),
        },
      });
      return;
    }
    const position = parseBrochurePosition(row?.[columns.positionCol]);
    const code = String(row?.[columns.codeCol] ?? "").trim();
    const sheetName = String(row?.[columns.nameCol] ?? "").trim();
    if (!code && !sheetName && !position) {
      ignored++;
      return;
    }
    const resolved = resolveExcelOffer(
      code,
      row,
      codeLookup,
      columns,
      rowNumber,
    );
    if (resolved.bundle && !resolved.product) {
      skipped.push({
        row: rowNumber,
        code,
        name: sheetName,
        reason: `Bundle codes not found in catalog: ${resolved.missingCodes.join(", ")}`,
      });
      return;
    }
    const catalogProduct =
      resolved.product ||
      (nameLookup.get(familyName(sheetName)) || []).find(
        (item: { code: string }) =>
          !code || importCode(item.code) === importCode(code),
      ) ||
      ((nameLookup.get(familyName(sheetName)) || []).length === 1
        ? nameLookup.get(familyName(sheetName))?.[0]
        : null);
    const importedProduct = resolved.bundle
      ? catalogProduct
      : code
        ? excelRowProduct(row, code, catalogProduct || null, columns, rowNumber)
        : catalogProduct;
    if (!importedProduct) {
      if (position || code)
        skipped.push({
          row: rowNumber,
          code: code || "—",
          name: sheetName,
          reason: "Product not found in catalog",
        });
      else ignored++;
      return;
    }
    const sale = parsePrice(row?.[columns.priceCol]);
    if (!(sale > 0)) {
      skipped.push({
        row: rowNumber,
        code,
        name: sheetName,
        reason: "Invalid sale price",
      });
      return;
    }
    const regular =
      parsePrice(row?.[columns.regularCol]) ||
      Number(importedProduct.regular) ||
      null;
    const importedDetails =
      columns.detailsCol >= 0
        ? splitImportedDetails(row?.[columns.detailsCol])
        : [];
    const details = importedDetails.length
      ? groupImportedPhoneDetails(importedProduct, importedDetails)
      : [];
    const color = resolved.bundle
      ? null
      : colorFrom(
          columns.colorCol >= 0
            ? row?.[columns.colorCol]
            : sheetName || catalogProduct?.name,
        );
    entries.push({
      row: rowNumber,
      position,
      color,
      sourceRows: 1,
      product: {
        ...importedProduct,
        regular,
        sale: String(sale),
        source: "import",
        confirmedAboveRegular: regular !== null && sale > regular,
        ...(position
          ? { brochurePage: position.page, brochureOrder: position.order }
          : {}),
        ...(details.length ? { brochureDetails: details } : {}),
      },
    });
  });
  entries.sort(
    (a, b) =>
      (a.position?.page ?? 999) - (b.position?.page ?? 999) ||
      (a.position?.order ?? 999) - (b.position?.order ?? 999) ||
      a.row - b.row,
  );
  const groups = new Map<string, Product[]>();
  const products: Product[] = [];
  for (const entry of entries) {
    const key = entry.position?.label || `row-${entry.row}`;
    const atPosition = groups.get(key) || [];
    const family = familyName(entry.product.name);
    const parent = atPosition.find(
      (item) =>
        familyName(item.name) === family &&
        Number(item.sale) === Number(entry.product.sale),
    );
    if (parent && isBundleOffer(parent) && parent.code === entry.product.code) {
      Object.assign(parent, entry.product);
    } else if (
      parent &&
      !isBundleOffer(parent) &&
      !isBundleOffer(entry.product) &&
      !parent.setSourceRows?.length &&
      !entry.product.setSourceRows?.length &&
      (entry.color || parent.code === entry.product.code)
    ) {
      parent.brochureVariants ||= [
        { code: parent.code, color: colorFrom(parent.name) || undefined },
      ];
      parent.brochureVariants.push({
        code: entry.product.code,
        color: entry.color || undefined,
      });
      if (entry.product.catalogMissing) {
        parent.catalogMissing = true;
        parent.missingCatalogCodes = [
          ...new Set([
            ...(parent.missingCatalogCodes || []),
            ...(entry.product.missingCatalogCodes || [entry.product.code]),
          ]),
        ];
      }
      if (!parent.image && entry.product.image)
        parent.image = entry.product.image;
    } else {
      if (atPosition.length && entry.position)
        warnings.push({
          position: key,
          row: entry.row,
          code: entry.product.code,
          name: entry.product.name,
          message: `Check brochure position ${key}: different products share this order.`,
        });
      atPosition.push(entry.product);
      products.push(entry.product);
      groups.set(key, atPosition);
    }
  }
  return {
    products,
    warnings,
    skipped,
    ignored,
    matchedRows: entries.reduce((sum, entry) => sum + entry.sourceRows, 0),
  };
}
