import type { Product } from "../../domain/models";
import {
  isStructuredDetailRow,
  savedDetailEntries,
  type DetailEntry,
} from "./detailFacts";

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
