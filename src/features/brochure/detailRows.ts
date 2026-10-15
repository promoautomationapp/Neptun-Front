import type { Product } from "../../domain/models";
import {
  isStructuredDetailRow,
  savedDetailEntries,
  type DetailEntry,
} from "./detailFacts";

const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// Appliance offers use the same concise fact selection as the brochure design.
// Source catalog specs remain intact. Imported lists, manually edited specs and
// independently edited blocks always remain authoritative.
export function brochureDefaultDetailEntries(
  product: Partial<Product>,
  entries: DetailEntry[],
): DetailEntry[] {
  if (Array.isArray(product.brochureDetails) || product.autoSpecsDisabled)
    return entries;
  const category = normalize(
    `${product.subcategory || ""} ${product.name || ""}`,
  );
  const washer = /rrobalarese|washing\s*machine|\bwasher\b/.test(category);
  const dishwasher = /enelarese|dishwasher/.test(category);
  if (!washer && !dishwasher) return entries;
  const available = entries.filter(
    ([key, value]) => value && !/garanc|warrant|ngjyr|colou?r/i.test(key),
  );
  const priorities = washer
    ? [
        /kapac|capacity/,
        /rrotull|spin\s*speed|^rpm$/,
        /program/,
        /motor|inverter/,
      ]
    : [
        /kapac|capacity|sete|place\s*setting/,
        /program/,
        /energ/,
        /zhurm|noise|sound/,
      ];
  const selected = new Set<string>();
  for (const priority of priorities) {
    const entry = available.find(([key, value]) =>
      priority.test(normalize(`${key} ${value}`)),
    );
    if (entry) selected.add(entry[0]);
  }
  // A sparse catalog should still display useful available facts. Never invent
  // a missing capacity, program count, technology or warranty.
  for (const [key] of available) {
    if (selected.size >= 4) break;
    selected.add(key);
  }
  for (const [key] of available) {
    if (
      Object.hasOwn(product.detailBlockPlacements || {}, key) ||
      Object.hasOwn(product.detailBlockStyles || {}, key)
    )
      selected.add(key);
  }
  const result: DetailEntry[] = [];
  for (const priority of priorities) {
    const entry = available.find(
      ([key, value]) =>
        selected.has(key) &&
        priority.test(normalize(`${key} ${value}`)) &&
        !result.some(([savedKey]) => savedKey === key),
    );
    if (entry) result.push(entry);
  }
  for (const entry of available) {
    if (selected.has(entry[0]) && !result.some(([key]) => key === entry[0]))
      result.push(entry);
  }
  return result;
}

export interface DetailRowsChanges {
  brochureDetails: NonNullable<Product["brochureDetails"]>;
  detailBlockPlacements: NonNullable<Product["detailBlockPlacements"]>;
  detailBlockStyles: NonNullable<Product["detailBlockStyles"]>;
}

function displayedRowsChanges(
  product: Partial<Product>,
  rows: readonly DetailEntry[],
): DetailRowsChanges {
  const saved = savedDetailEntries(product);
  const originalRows = new Map(
    saved?.map(([key], index) => [key, product.brochureDetails?.[index]]),
  );
  const manual = Array.isArray(product.brochureDetails);
  const nextKeys: string[] = [];
  const brochureDetails = rows.map(([key, value], index) => {
    const original = originalRows.get(key);
    if (isStructuredDetailRow(original)) {
      nextKeys.push(original.key);
      return { ...original, text: value };
    }
    nextKeys.push(String(index));
    return manual ? value : `${key}: ${value}`;
  });
  const remap = <T>(edits: Record<string, T> | undefined): Record<string, T> =>
    Object.fromEntries([
      ...Object.entries(edits || {}).filter(([key]) => key.startsWith("__")),
      ...rows.flatMap(([key], index) => {
        const value = edits?.[key];
        return value === undefined ? [] : [[nextKeys[index]!, value]];
      }),
    ]);
  return {
    brochureDetails,
    detailBlockPlacements: remap(product.detailBlockPlacements),
    detailBlockStyles: remap(product.detailBlockStyles),
  };
}

// A surviving structured row keeps its original key and associated edits.
// Legacy strings retain their indexed convention, remapping edits with them.
export function deleteDisplayedDetail(
  product: Partial<Product>,
  rows: readonly DetailEntry[],
  index: number,
): DetailRowsChanges | Record<string, never> {
  if (!Number.isInteger(index) || index < 0 || index >= rows.length) return {};
  return displayedRowsChanges(
    product,
    rows.filter((_, position) => position !== index),
  );
}

export function reorderDisplayedDetails(
  product: Partial<Product>,
  rows: readonly DetailEntry[],
  from: number,
  to: number,
): DetailRowsChanges | Record<string, never> {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= rows.length ||
    to >= rows.length ||
    from === to
  )
    return {};
  const reordered = [...rows];
  const moved = reordered.splice(from, 1);
  reordered.splice(to, 0, ...moved);
  return displayedRowsChanges(product, reordered);
}

export function brochureVisibleDetailEntries(
  entries: readonly DetailEntry[],
  {
    columns = 2,
    warrantyInStrip = false,
  }: { columns?: number; warrantyInStrip?: boolean } = {},
): DetailEntry[] {
  const blocks = columns >= 3 ? 3 : 5;
  return entries.slice(0, Math.max(1, blocks - Number(warrantyInStrip)));
}

export function editDisplayedDetail(
  product: Partial<Product>,
  rows: readonly DetailEntry[],
  index: number,
  text: string,
): DetailRowsChanges {
  const manual = Array.isArray(product.brochureDetails);
  const values: DetailEntry[] = rows.map(([key, value], position) => [
    key,
    position === index ? text : manual ? value : `${key}: ${value}`,
  ]);
  return displayedRowsChanges(
    { ...product, brochureDetails: product.brochureDetails || [] },
    values,
  );
}
