import type { BrochureImportWarning, Product } from "../../domain/models";
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
import type { ImportRow, ImportRowGroup } from "./importRowGroups";
import { groupImportedPhoneDetails } from "./mobileDetails";
import {
  excelRowProduct,
  inferExcelProductColumns,
  resolveExcelOffer,
  splitExcelDetails,
} from "./excelProducts";
import type { ExcelProductColumns } from "./excelProducts";
import {
  collapseImportedColorVariants,
  colorVariantName,
  productImportColor,
  sameColorVariantModel,
} from "./importedColorVariants";
import type { ImportedColor } from "./importedColorVariants";

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
type BrochureWarning = BrochureImportWarning;

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
            // A plain integer could be stock or another numeric fact. Infer
            // an unlabeled position column only from dotted page.order values.
            return (
              /[.,]/.test(String(row?.[index] ?? "")) &&
              parsed &&
              parsed.page <= 80 &&
              parsed.order <= 30
            );
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
  if (/^\d+$/.test(clean)) {
    const page = Number(clean);
    return page >= 1 && page <= 999
      ? { page, order: 0, label: `${page}.0` }
      : null;
  }
  const match = clean.match(/^(\d+)\.(\d+)$/);
  if (!match) return null;
  const page = Number(match[1]);
  const order = Number(match[2]);
  return page >= 1 && page <= 999 && order >= 0 && order <= 999
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

function catalogByName(catalog: Product[]) {
  const byName = new Map<string, Product[]>();
  for (const product of catalog) {
    const key = colorVariantName(product.name);
    if (!key) continue;
    const matches = byName.get(key) || [];
    matches.push(product);
    byName.set(key, matches);
  }
  return byName;
}

/** The complete page.order identifies an offer. Different order numbers on the
 * same page stay separate; repeated positions group distinct product codes. */
function groupPositionOffers(
  rows: readonly ImportRow[],
  columns: BrochureImportColumns,
) {
  const original = groupImportRows(rows, columns.setCol ?? -1).flatMap(
    (group) => {
      if (!group.set) return [group];
      const parts: ImportRowGroup[] = [];
      let previousPosition: string | undefined;
      for (const source of group.sources) {
        const position = parseBrochurePosition(
          source.row[columns.positionCol],
        )?.label;
        if (
          !parts.length ||
          (position && previousPosition && position !== previousPosition)
        )
          parts.push({ set: true, sources: [] });
        parts.at(-1)!.sources.push(source);
        if (position) previousPosition = position;
      }
      return parts.map((part) =>
        part.sources.length === 1 &&
        parseBrochurePosition(part.sources[0]!.row[columns.positionCol])
          ? { ...part, set: false }
          : part,
      );
    },
  );
  const positions = new Map<string, ImportRowGroup[]>();
  for (const group of original) {
    const source =
      group.sources.find((source) =>
        parseBrochurePosition(source.row[columns.positionCol]),
      ) || group.sources[0];
    if (!source || !String(source.row[columns.codeCol] ?? "").trim()) continue;
    const position = parseBrochurePosition(source.row[columns.positionCol]);
    if (position)
      positions.set(position.label, [
        ...(positions.get(position.label) || []),
        group,
      ]);
  }
  const replacements = new Map<ImportRowGroup, ImportRowGroup>();
  const consumed = new Set<ImportRowGroup>();
  for (const groups of positions.values()) {
    if (groups.length < 2) continue;
    // Different descriptions of a repeated source SKU do not make a bundle.
    const codes = new Set(
      groups.flatMap((group) =>
        group.sources.map((source) => importCode(source.row[columns.codeCol])),
      ),
    );
    if (codes.size < 2) continue;
    replacements.set(groups[0]!, {
      set: true,
      positionGrouped: true,
      sources: groups.flatMap((group) => group.sources),
    });
    groups.slice(1).forEach((group) => consumed.add(group));
  }
  return original
    .filter((group) => !consumed.has(group))
    .map((group) => replacements.get(group) || group);
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
  const incompleteProducts: Product[] = [];
  let ignored = 0;
  const importGroup = (group: ImportRowGroup) => {
    const first = group.sources[0];
    if (!first) return;
    const { row, index } = first;
    const rowNumber = rowOffset + index;
    if (group.set) {
      const sourcePositions = group.sources.map(({ row }) =>
        parseBrochurePosition(row[columns.positionCol]),
      );
      const exactPosition = sourcePositions.every(
        (position) => position && position.label === sourcePositions[0]?.label,
      );
      const distinctRegular = new Set(
        group.sources
          .map((source) => parsePrice(source.row[columns.regularCol]))
          .filter((value) => value > 0),
      );
      const individualRegular =
        (group.positionGrouped || exactPosition) && distinctRegular.size > 1;
      const sourceCodes = new Set<string>();
      const memberGroup = group.positionGrouped
        ? {
            ...group,
            sources: group.sources.filter(({ row }) => {
              const key = importCode(row[columns.codeCol]);
              if (sourceCodes.has(key)) return false;
              sourceCodes.add(key);
              return true;
            }),
          }
        : group;
      const resolved = resolveSetMembers(
        memberGroup,
        columns.codeCol,
        codeLookup,
        rowOffset,
        (source, code) =>
          resolveExcelOffer(
            code,
            source.row,
            codeLookup,
            {
              ...columns,
              regularCol: individualRegular ? columns.regularCol : -1,
            },
            rowOffset + source.index,
          ),
      );
      const sharedSale = sharedSetPrice(group, columns.priceCol, rowOffset);
      const hasRegular =
        !individualRegular &&
        columns.regularCol >= 0 &&
        group.sources.some(({ row }) =>
          String(row[columns.regularCol] ?? "").trim(),
        );
      const sharedRegular = hasRegular
        ? sharedSetPrice(group, columns.regularCol, rowOffset, "regular")
        : null;
      // Position inference may be wrong when rows have different or missing
      // prices. Preserve those rows as individual offers or editable incomplete
      // products; only an explicitly marked Set requires one shared price.
      const explicitSet = group.sources.some(
        ({ row }) =>
          (columns.setCol ?? -1) >= 0 &&
          normalize(String(row[columns.setCol!] ?? "")) === "set",
      );
      if (group.positionGrouped && !explicitSet && sharedSale.error) {
        group.sources.forEach((source) =>
          importGroup({ set: false, sources: [source] }),
        );
        return;
      }
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
      const candidates = resolved.members.map((member) => {
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
        const product: Product = {
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
        return {
          product,
          color:
            productImportColor(product, imported?.[columns.colorCol]) ||
            (codeLookup.get(importCode(member.code))
              ? productImportColor(codeLookup.get(importCode(member.code))!)
              : null),
          // A positioned Set may describe color choices too. The slot plus
          // model/spec/price agreement is the evidence; the Set label alone
          // must not force interchangeable finishes into separate products.
          eligible: exactPosition && !source?.bundle,
          regular:
            parsePrice(imported?.[columns.regularCol]) || product.regular,
          sale: sharedSale.value,
        };
      });
      const collapsed = collapseImportedColorVariants(candidates);
      const members = collapsed.map(({ product }) => product);
      const onlyColorChoices =
        exactPosition &&
        members.length === 1 &&
        (members[0]?.brochureVariants?.length || 0) > 1;
      const product = onlyColorChoices
        ? structuredClone(members[0]!)
        : setOfferProduct(
            members,
            rowNumber,
            group.sources.map(({ index }) => rowOffset + index),
          );
      if (product.bundleProducts?.length) {
        product.bundleCodes = members.flatMap((member) =>
          member.brochureVariants?.length
            ? member.brochureVariants.map(
                (variant) => variant.code || member.code,
              )
            : [member.code],
        );
      }
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
          kind: "set-position-conflict",
          severity: "warning",
          relatedRows: positions.map((entry) => entry.row),
          positions: [
            ...new Set(positions.map((entry) => entry.position.label)),
          ],
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
        color: onlyColorChoices ? collapsed[0]!.color : null,
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
    let sourceHash = 2166136261;
    for (const character of JSON.stringify([
      sheetName || [rowNumber, position?.label, row[columns.detailsCol]],
      row[columns.brandCol],
    ]))
      sourceHash = Math.imul(sourceHash ^ character.charCodeAt(0), 16777619);
    const importedCode = code || `EXCEL-${(sourceHash >>> 0).toString(36)}`;
    if (!code && !sheetName && !position) {
      ignored++;
      return;
    }
    const keepIncomplete = (catalogProduct: Product | null = null) => {
      const product = excelRowProduct(
        row,
        importedCode,
        catalogProduct,
        columns,
        rowNumber,
      );
      if (!product) return;
      const placeholderName = `Excel row ${rowNumber}`;
      if (!sheetName && !catalogProduct) {
        product.name = placeholderName;
        product.excelSource = { ...product.excelSource!, placeholderName };
      }
      incompleteProducts.push({
        ...product,
        source: "import",
        sale:
          parsePrice(row[columns.priceCol]) > 0
            ? String(parsePrice(row[columns.priceCol]))
            : "",
        ...(position
          ? { brochurePage: position.page, brochureOrder: position.order }
          : {}),
      });
    };
    if (!code && !sheetName && position) {
      keepIncomplete();
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
      (nameLookup.get(colorVariantName(sheetName)) || []).find(
        (item: { code: string }) =>
          !code || importCode(item.code) === importCode(code),
      ) ||
      ((nameLookup.get(colorVariantName(sheetName)) || []).length === 1
        ? nameLookup.get(colorVariantName(sheetName))?.[0]
        : null);
    const importedProduct = resolved.bundle
      ? catalogProduct
      : excelRowProduct(
          row,
          importedCode,
          catalogProduct || null,
          columns,
          rowNumber,
        );
    if (!importedProduct) {
      if (position || code)
        skipped.push({
          row: rowNumber,
          code: code || "—",
          name: sheetName,
          reason: "Missing product code and name in Excel",
        });
      else ignored++;
      return;
    }
    const sale = parsePrice(row?.[columns.priceCol]);
    if (!(sale > 0)) {
      keepIncomplete(catalogProduct || null);
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
      : productImportColor(importedProduct, row?.[columns.colorCol]) ||
        (catalogProduct ? productImportColor(catalogProduct) : null);
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
  };
  groupPositionOffers(rows, columns).forEach(importGroup);
  entries.sort(
    (a, b) =>
      (a.position?.page ?? 999) - (b.position?.page ?? 999) ||
      (a.position?.order ?? 999) - (b.position?.order ?? 999) ||
      a.row - b.row,
  );
  const groups = new Map<string, Product[]>();
  const positionRows = new Map<string, number[]>();
  const sharedOrderNotices = new Map<string, BrochureWarning>();
  const products: Product[] = [];
  for (const entry of entries) {
    const key = entry.position?.label || `row-${entry.row}`;
    const atPosition = groups.get(key) || [];
    const family = colorVariantName(entry.product.name);
    const parent = atPosition.find(
      (item) =>
        colorVariantName(item.name) === family &&
        sameColorVariantModel(item, entry.product) &&
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
        { code: parent.code, color: productImportColor(parent) || undefined },
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
      const rowsAtPosition = positionRows.get(key) || [];
      if (atPosition.length && entry.position) {
        // The position is a sorting hint, not a fixed canvas cell. Equal values
        // keep separate offers in source-row order and are valid brochure data.
        const notice = sharedOrderNotices.get(key) || {
          kind: "shared-order" as const,
          severity: "info" as const,
          position: key,
          row: entry.row,
          code: entry.product.code,
          name: entry.product.name,
          message:
            "These offers share a brochure position. They were kept as separate cards in Excel row order.",
        };
        notice.relatedRows = [...rowsAtPosition, entry.row];
        notice.relatedCodes = [
          ...atPosition.map((product) => product.code),
          entry.product.code,
        ];
        sharedOrderNotices.set(key, notice);
      }
      rowsAtPosition.push(entry.row);
      positionRows.set(key, rowsAtPosition);
      atPosition.push(entry.product);
      products.push(entry.product);
      groups.set(key, atPosition);
    }
  }
  return {
    products,
    incompleteProducts,
    warnings: [...warnings, ...sharedOrderNotices.values()],
    skipped,
    ignored,
    matchedRows: entries.reduce((sum, entry) => sum + entry.sourceRows, 0),
  };
}

/** Merge complete and incomplete rows without changing spreadsheet placement. */
export function sortBrochureProducts(products: readonly Product[]) {
  return [...products].sort(
    (a, b) =>
      (a.brochurePage ?? 999) - (b.brochurePage ?? 999) ||
      (a.brochureOrder ?? 999) - (b.brochureOrder ?? 999) ||
      (a.excelSource?.row ?? a.setSourceRows?.[0] ?? 0) -
        (b.excelSource?.row ?? b.setSourceRows?.[0] ?? 0),
  );
}
