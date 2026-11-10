import type { Product } from "../../domain/models";
import { savedDetailEntries, type DetailEntry } from "./detailFacts";
import { deleteDisplayedDetail } from "./detailRows";

export interface BlueReferenceDetailGroup {
  key: string;
  entries: DetailEntry[];
  text: string;
}

/** Automatic blue offers keep every supplied fact in three compact rectangles.
 * Explicit row editing or an independently positioned/styled fact remains a
 * one-to-one editable list instead of being repacked on a later render. */
export function blueReferenceDetailGroups(
  product: Partial<Product>,
  entries: readonly DetailEntry[],
  { phone = false, imported = false } = {},
): BlueReferenceDetailGroup[] | null {
  const edited =
    product.autoSpecsDisabled ||
    Object.keys(product.detailBlockPlacements || {}).some(
      (key) => !key.startsWith("__"),
    ) ||
    Object.keys(product.detailBlockStyles || {}).some(
      (key) => !key.startsWith("__"),
    );
  if (edited) return null;
  const text = ([key, value]: DetailEntry) => {
    const label = key.trim();
    const supplied = value.trim();
    if (!supplied) return label;
    if (
      imported ||
      /^\d+$/.test(label) ||
      label.toLowerCase() === supplied.toLowerCase()
    )
      return supplied;
    return `${label}: ${supplied}`;
  };
  const groups: DetailEntry[][] = [];
  if (phone) {
    const categories = [
      /(?:android|\bios\b|sistemi|operating system)/i,
      /(?:kamera|camera|front|\b\d+\s*mp\b)/i,
      /(?:memor|storage|\bram\b|\b\d+\s*(?:gb|tb)\b)/i,
      /(?:bater|battery|\bmah\b)/i,
    ];
    const selected = categories.map(() => [] as DetailEntry[]);
    for (const entry of entries) {
      const source = `${entry[0]} ${entry[1]}`;
      const category = categories.findIndex((pattern) => pattern.test(source));
      if (category >= 0) selected[category]!.push(entry);
      // Screen size has its own external annotation. Other optional facts
      // remain available in the editor without crowding the four key boxes.
    }
    groups.push(...selected.filter((group) => group.length));
  } else {
    const count = Math.min(3, entries.length);
    for (let index = 0; index < count; index++) {
      const start = Math.floor((index * entries.length) / count);
      const end = Math.floor(((index + 1) * entries.length) / count);
      groups.push(entries.slice(start, end));
    }
  }
  return groups.map((members) => ({
    key: members[0]![0],
    entries: members,
    text: members.map(text).join("\n"),
  }));
}

/** Remove the complete visual group, keeping original structured keys and
 * per-row edits for every surviving source fact. */
export function removeBlueReferenceDetailGroup(
  product: Product,
  entries: readonly DetailEntry[],
  keys: readonly string[],
) {
  const indexes = entries
    .flatMap(([key], index) => (keys.includes(key) ? [index] : []))
    .sort((a, b) => b - a);
  let next = product;
  let rows = [...entries];
  let changes: Partial<Product> = {};
  for (const index of indexes) {
    const update = deleteDisplayedDetail(next, rows, index);
    changes = { ...changes, ...update };
    next = { ...next, ...update };
    rows = savedDetailEntries(next) || [];
  }
  return changes;
}
