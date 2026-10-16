import { useMemo, type ReactNode } from "react";
import type { Product } from "../../domain/models";
import { t } from "../brochure/i18n";
import { CategoryTreeSelect } from "../brochure/CategoryTreeSelect";
import { FilterSelect } from "../brochure/FilterControls";
import { productCategoryPath } from "../settings/categoryHierarchy";
import "../../styles/catalog-navigator.css";
export interface CatalogSelection {
  categoryPath: string;
  brand: string;
  availability: string;
}
export function defaultCatalogSelection(
  _products: Product[],
  _sourcePaths: string[] = [],
): CatalogSelection {
  // Opening the catalog must not silently hide brands in an arbitrary branch.
  return { categoryPath: "", brand: "", availability: "all" };
}
export function filterCatalog(
  products: Product[],
  selection: CatalogSelection,
): Product[] {
  return products.filter((product) => {
    const path = productCategoryPath(product);
    return (
      (!selection.categoryPath ||
        path === selection.categoryPath ||
        path.startsWith(`${selection.categoryPath} > `)) &&
      (!selection.brand || product.brand === selection.brand) &&
      (selection.availability === "missing"
        ? product.sourceMissing
        : selection.availability === "listed"
          ? !product.sourceMissing
          : true)
    );
  });
}
export function CatalogNavigator({
  products,
  selection,
  onChange,
  sourcePaths = [],
  children,
  onClear,
}: {
  products: Product[];
  children?: ReactNode;
  onClear?: () => void;
  sourcePaths?: string[];
  selection: CatalogSelection;
  onChange: (selection: CatalogSelection) => void;
}) {
  const path = selection.categoryPath.split(" > ").filter(Boolean);
  const branch = useMemo(
    () =>
      filterCatalog(products, { ...selection, brand: "", availability: "all" }),
    [products, selection.categoryPath],
  );
  const brands = [
    ...new Set(branch.map((product) => product.brand).filter(Boolean)),
  ].sort((a, b) => String(a).localeCompare(String(b)));
  return (
    <section
      className="cs-catalog-navigator"
      aria-label={t("Catalog categories and brands")}
    >
      <div className="cs-catalog-filter-head">
        <strong>{t("Browse by category")}</strong>
        <small>
          {t("Choose a category, then narrow it down step by step.")}
        </small>
        <button
          type="button"
          onClick={() => {
            onChange({ categoryPath: "", brand: "", availability: "all" });
            onClear?.();
          }}
        >
          {t("Clear filters")}
        </button>
      </div>
      {children && <div className="cs-catalog-filter-searches">{children}</div>}
      <div className="cs-catalog-filter-fields">
        <div className="cs-catalog-field cs-catalog-category-field">
          <CategoryTreeSelect
            catalog={products}
            sourcePaths={sourcePaths}
            label={t("Category")}
            category={path[0] || ""}
            subcategory={path.length > 1 ? path.at(-1) || "" : ""}
            categoryPath={selection.categoryPath}
            onChange={() => {}}
            onPathChange={(categoryPath) =>
              onChange({ ...selection, categoryPath, brand: "" })
            }
          />
        </div>
        <div className="cs-catalog-field">
          <FilterSelect
            label={t("Brand")}
            value={selection.brand}
            onChange={(brand) => onChange({ ...selection, brand })}
            options={[
              { value: "", label: t("All brands") },
              ...brands.map((brand) => ({ value: brand!, label: brand! })),
            ]}
          />
        </div>
        <div className="cs-catalog-field">
          <FilterSelect
            label={t("Website availability")}
            value={selection.availability}
            onChange={(availability) =>
              onChange({ ...selection, availability })
            }
            options={[
              { value: "all", label: t("All saved products") },
              { value: "listed", label: t("Found on Neptun website") },
              {
                value: "missing",
                label: t("Kept in catalog · not found on website"),
              },
            ]}
          />
        </div>
      </div>
      <nav
        className="cs-catalog-crumbs"
        aria-label={t("Selected category path")}
      >
        {path.map((part, index) => (
          <button
            type="button"
            key={index}
            onClick={() =>
              onChange({
                ...selection,
                categoryPath: path.slice(0, index + 1).join(" > "),
                brand: "",
              })
            }
          >
            {index > 0 && <span aria-hidden="true">› </span>}
            {part}
          </button>
        ))}
      </nav>
    </section>
  );
}
