import { useMemo } from "react";
import type { Product } from "../../domain/models";
import { t } from "../brochure/i18n";
import { FilterSelect } from "../brochure/FilterControls";
import { categoryNodes, productCategoryPath } from "../settings/categoryHierarchy";
import "../../styles/catalog-navigator.css";
export interface CatalogSelection { categoryPath: string; brand: string; availability: string }
export function defaultCatalogSelection(products: Product[]): CatalogSelection {
  const roots = categoryNodes(products.map(product => ({ category: product.category || "", subcategory: product.subcategory || "", categoryPath: product.categoryPath }))).filter(node => !node.parent);
  return { categoryPath: roots[0]?.path || "", brand: "", availability: "all" };
}
export function filterCatalog(products: Product[], selection: CatalogSelection): Product[] {
  return products.filter(product => {
    const path = productCategoryPath(product);
    return (!selection.categoryPath || path === selection.categoryPath || path.startsWith(`${selection.categoryPath} > `)) && (!selection.brand || product.brand === selection.brand) && (selection.availability === "missing" ? product.sourceMissing : selection.availability === "listed" ? !product.sourceMissing : true);
  });
}
export function CatalogNavigator({ products, selection, onChange }: { products: Product[]; selection: CatalogSelection; onChange: (selection: CatalogSelection) => void }) {
  const nodes = useMemo(() => categoryNodes(products.map(product => ({ category: product.category || "", subcategory: product.subcategory || "", categoryPath: product.categoryPath }))), [products]);
  const path = selection.categoryPath.split(" > ").filter(Boolean);
  const levels = Array.from({ length: path.length + 1 }, (_, depth) => {
    const parent = path.slice(0, depth).join(" > ");
    return { parent, depth, children: nodes.filter(node => node.parent === parent) };
  }).filter(level => level.children.length);
  const branch = useMemo(() => filterCatalog(products, { ...selection, brand: "", availability: "all" }), [products, selection.categoryPath]);
  const brands = [...new Set(branch.map(product => product.brand).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  return <section className="cs-catalog-navigator" aria-label={t("Catalog categories and brands")}>
    <div className="cs-catalog-filter-head"><strong>{t("Browse by category")}</strong><small>{t("Choose a category, then narrow it down step by step.")}</small><button type="button" onClick={() => onChange({ categoryPath: "", brand: "", availability: "all" })}>{t("Clear filters")}</button></div>
    <div className="cs-catalog-filter-fields">
      {levels.map(({ parent, depth, children }) => <div key={parent} className="cs-catalog-field"><FilterSelect label={t(depth === 0 ? "Category" : depth === 1 ? "Subcategory" : depth === 2 ? "Sub-subcategory" : "Category level") + (depth > 2 ? ` ${depth + 1}` : "")} value={path.slice(0, depth + 1).join(" > ")} onChange={categoryPath => onChange({ ...selection, categoryPath, brand: "" })} options={[{ value: parent, label: t(depth === 0 ? "All categories" : "All in this branch") }, ...children.map(node => ({ value: node.path, label: node.label }))]} /></div>)}
      <div className="cs-catalog-field"><FilterSelect label={t("Brand")} value={selection.brand} onChange={brand => onChange({ ...selection, brand })} options={[{ value: "", label: t("All brands") }, ...brands.map(brand => ({ value: brand!, label: brand! }))]} /></div>
      <div className="cs-catalog-field"><FilterSelect label={t("Website availability")} value={selection.availability} onChange={availability => onChange({ ...selection, availability })} options={[{ value: "all", label: t("All saved products") }, { value: "listed", label: t("Found on Neptun website") }, { value: "missing", label: t("Kept in catalog · not found on website") }]} /></div>
    </div>
    {selection.categoryPath && <nav className="cs-catalog-crumbs" aria-label={t("Selected category path")}>{path.map((part, index) => <button type="button" key={index} onClick={() => onChange({ ...selection, categoryPath: path.slice(0, index + 1).join(" > "), brand: "" })}>{index > 0 && <span aria-hidden="true">› </span>}{part}</button>)}</nav>}
  </section>;
}
