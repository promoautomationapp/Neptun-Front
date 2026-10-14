import { categorySegments, productCategoryPath } from "./categoryHierarchy";
import type { Campaign, Product } from "../../domain/models";

const modes = new Set(["amount", "percentage"]);
export function resolvedSavingsMode(
  campaign: Partial<Campaign> | null | undefined,
  product?: Partial<Product> | null,
): string {
  if (modes.has(product?.savingMode || "")) return product!.savingMode!;
  const parts = categorySegments(productCategoryPath(product || {}));
  const key = parts.join(" > ").toLocaleLowerCase();
  const candidates: Array<{ mode: string; depth: number; priority: number }> =
    [];
  for (const [path, mode] of Object.entries(
    campaign?.categoryPathSavingModes || {},
  )) {
    const pathParts = categorySegments(path);
    if (!pathParts.length) continue;
    const normalized = pathParts.join(" > ").toLocaleLowerCase();
    if (
      modes.has(mode) &&
      (key === normalized || key.startsWith(`${normalized} > `))
    )
      candidates.push({ mode, depth: pathParts.length, priority: 1 });
  }
  const legacy = campaign?.categorySavingModes?.[product?.category || ""];
  if (modes.has(legacy?.mode || ""))
    candidates.push({ mode: legacy!.mode!, depth: 1, priority: 0 });
  const subcategoryMode = legacy?.subcategories?.[product?.subcategory || ""];
  if (modes.has(subcategoryMode || ""))
    candidates.push({
      mode: subcategoryMode!,
      depth: Math.max(2, parts.length),
      priority: 0,
    });
  const match = candidates.sort(
    (a, b) => b.depth - a.depth || b.priority - a.priority,
  )[0];
  if (match) return match.mode;
  if (campaign?.automaticSavings?.enabled) {
    const regular = Number(String(product?.regular ?? "").replace(",", "."));
    const sale = Number(String(product?.sale ?? "").replace(",", "."));
    if (
      Number.isFinite(regular) &&
      Number.isFinite(sale) &&
      regular > sale &&
      sale >= 0
    ) {
      return regular - sale < campaign.automaticSavings.amountThreshold
        ? "percentage"
        : "amount";
    }
  }
  return modes.has(campaign?.savingMode || "")
    ? campaign!.savingMode!
    : "amount";
}
