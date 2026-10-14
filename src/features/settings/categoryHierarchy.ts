export interface CategoryFacet {
  category: string;
  subcategory: string;
  categoryPath?: string;
}
export interface CategoryNode {
  path: string;
  label: string;
  depth: number;
  parent: string;
}
export function categorySegments(value: string): string[] {
  return String(value || "")
    .split(/\s*(?:>|›)\s*/)
    .map((part) => part.replace(/^[\s•·\-*]+/, "").trim())
    .filter(
      (part) => part && !/^(?:home|ballina|kreu|sht[eë]pia)$/i.test(part),
    );
}
export function productCategoryPath(product: Partial<CategoryFacet>): string {
  const parts = categorySegments(product.categoryPath || "");
  return (
    parts.length
      ? parts
      : [product.category, product.subcategory].filter(
          (part, index, values) => part && values.indexOf(part) === index,
        )
  ).join(" > ");
}
export function categoryNodes(
  facets: CategoryFacet[],
  savedPaths: string[] = [],
): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  for (const path of [...facets.map(productCategoryPath), ...savedPaths]) {
    const parts = categorySegments(path);
    parts.forEach((label, depth) => {
      const current = parts.slice(0, depth + 1).join(" > ");
      nodes.set(current, {
        path: current,
        label,
        depth,
        parent: parts.slice(0, depth).join(" > "),
      });
    });
  }
  return [...nodes.values()].sort((a, b) => a.path.localeCompare(b.path));
}
