import { t } from "../brochure/i18n";
import { SettingsGroup } from "./components";
import { useEffect, useId, useMemo, useState } from "react";
import { Field, Toggle } from "./components";
import { SavingSelect } from "./OffersTab";
import type { SettingsTabProps } from "./SettingsEditor";
import { categoryNodes, type CategoryFacet } from "./categoryHierarchy";
import { resolvedSavingsMode } from "./savingsPolicy";
import { matchesSearch } from "../brochure/searchText";
import { SearchableSelect } from "../../components/SearchableSelect";

export function CategoryDefaultsTab({
  draft,
  update,
  facets,
  facetsError,
  onPreviewCategory,
}: SettingsTabProps & {
  facets: CategoryFacet[];
  facetsError?: string;
  onPreviewCategory: (path: string) => void;
}) {
  const [query, setQuery] = useState("");
  const nodes = useMemo(
    () =>
      categoryNodes(facets, [
        ...Object.keys(draft.categoryPathSavingModes),
        ...Object.entries(draft.categorySavingModes).flatMap(
          ([category, rule]) => [
            category,
            ...Object.keys(rule.subcategories || {}).map(
              (sub) => `${category} > ${sub}`,
            ),
          ],
        ),
      ]),
    [facets, draft.categoryPathSavingModes, draft.categorySavingModes],
  );
  const [selection, setSelection] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const selected = nodes.find((node) => node.path === selection) || nodes[0];
  const id = useId();
  useEffect(() => {
    onPreviewCategory(selected?.path || "");
  }, [selected?.path, onPreviewCategory]);
  const parents = new Set(nodes.map((node) => node.parent).filter(Boolean));
  const searching = Boolean(query.trim());
  const matches = new Set<string>();
  if (searching) {
    for (const node of nodes.filter((item) =>
      matchesSearch(
        `${item.path} ${item.path.split(" > ").map(t).join(" > ")}`,
        query,
      ),
    )) {
      const parts = node.path.split(" > ");
      parts.forEach((_, index) =>
        matches.add(parts.slice(0, index + 1).join(" > ")),
      );
    }
  }
  const visible = nodes.filter((node) =>
    searching
      ? matches.has(node.path)
      : node.path
          .split(" > ")
          .slice(0, -1)
          .every((_, index, parts) =>
            expanded.has(parts.slice(0, index + 1).join(" > ")),
          ),
  );
  function toggleBranch(path: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }
  const selectedParts = selected?.path.split(" > ") || [];
  const legacy = selected
    ? draft.categorySavingModes[selected.path]?.mode ||
      (selectedParts.length === 2
        ? draft.categorySavingModes[selectedParts[0]!]?.subcategories?.[
            selectedParts[1]!
          ]
        : undefined)
    : undefined;
  const value = selected
    ? draft.categoryPathSavingModes[selected.path] || legacy || ""
    : "";
  const example = (regular: number, sale: number) =>
    resolvedSavingsMode(draft, { regular, sale }) === "percentage"
      ? `ZBRITJE ${Math.round(((regular - sale) / regular) * 100)}%`
      : `KURSENI ${regular - sale}€`;
  function choose(value: string) {
    if (!selected) return;
    update((next) => {
      if (value === "amount" || value === "percentage")
        next.categoryPathSavingModes[selected.path] = value;
      else delete next.categoryPathSavingModes[selected.path];
      // Remove an older equivalent rule so choosing inheritance has its intended effect.
      if (selected.depth === 0 && next.categorySavingModes[selected.path])
        delete next.categorySavingModes[selected.path]!.mode;
      const parts = selected.path.split(" > ");
      if (parts.length === 2)
        delete next.categorySavingModes[parts[0]!]?.subcategories?.[parts[1]!];
    });
  }
  return (
    <section className="ns-section">
      <h2>{t("Category and subcategory defaults")}</h2>
      <p>
        {t(
          "Offers below €30 use Zbritje (%) by default. Coffee machines and vacuum cleaners keep Kurseni (€). Category choices override their parent; product edits take priority.",
        )}
      </p>
      <SettingsGroup
        title={<> {t("Automatic savings for small and large offers")} </>}
      >
        <Toggle
          label="Choose savings labels automatically"
          checked={draft.automaticSavings.enabled}
          onChange={(enabled) =>
            update((next) => {
              next.automaticSavings.enabled = enabled;
            })
          }
        />
        <Field label="Apply the threshold to">
          <SearchableSelect
            value={draft.automaticSavings.basis}
            onChange={(event) =>
              update((next) => {
                next.automaticSavings.basis = event.target
                  .value as typeof next.automaticSavings.basis;
              })
            }
          >
            <option value="offer-price">{t("Offer price")}</option>
            <option value="savings-amount">{t("Amount saved")}</option>
          </SearchableSelect>
        </Field>
        <Field
          label={
            draft.automaticSavings.basis === "offer-price"
              ? "Offer price threshold (€)"
              : "Show saved euros from this amount"
          }
          hint={
            draft.automaticSavings.basis === "offer-price"
              ? "Below this offer price, show Zbritje (%). Coffee machines and vacuum cleaners keep Kurseni (€). Product and category choices take priority."
              : "Below this amount, show Zbritje (%). At or above it, show Kurseni (€), unless a category or product overrides it."
          }
        >
          <input
            type="number"
            min={0}
            max={100000}
            step={1}
            value={draft.automaticSavings.amountThreshold}
            onChange={(event) =>
              update((next) => {
                next.automaticSavings.amountThreshold = Number(
                  event.target.value,
                );
              })
            }
          />
        </Field>
        <div
          className="ns-savings-examples"
          aria-label={t("Automatic savings examples")}
        >
          <div>
            <small>{t("Lower offer price")}</small>
            <strong>{example(39, 29)}</strong>
            <span>€39 → €29</span>
          </div>
          <div>
            <small>{t("At or above the threshold")}</small>
            <strong>{example(50, 30)}</strong>
            <span>€50 → €30</span>
          </div>
        </div>
      </SettingsGroup>
      {facetsError && (
        <p role="alert">
          {t(facetsError)} {t("Saved category choices remain available.")}
        </p>
      )}
      {!nodes.length && (
        <p>
          {t(
            "No catalog categories yet. Fetch products from neptun-ks.com to load the hierarchy.",
          )}
        </p>
      )}
      <div className="ns-category-workspace">
        <div className="ns-category-browser">
          <div className="ns-category-search">
            <Field label="Find category or subcategory">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </Field>
            <p className="ns-category-guidance">
              {t(
                "Choose a category, then open its subcategories to narrow the rule.",
              )}
            </p>
            {query && (
              <button
                type="button"
                className="ns-category-collapse"
                onClick={() => setQuery("")}
              >
                {t("Clear search")}
              </button>
            )}
            {!searching && (
              <button
                type="button"
                className="ns-category-collapse"
                onClick={() => setExpanded(new Set(parents))}
              >
                {t("Expand all")}
              </button>
            )}
            {expanded.size > 0 && !searching && (
              <button
                type="button"
                className="ns-category-collapse"
                onClick={() => {
                  setExpanded(new Set());
                  setSelection(selected?.path.split(" > ")[0] || "");
                }}
              >
                {t("Collapse all")}
              </button>
            )}
          </div>
          <div
            className="ns-category-tabs"
            role="tree"
            aria-label={t("Categories and subcategories")}
          >
            {visible.map((node, index) => (
              <button
                type="button"
                role="treeitem"
                key={node.path}
                id={`${id}-${nodes.indexOf(node)}`}
                aria-label={t(node.label)}
                aria-describedby={`${id}-${nodes.indexOf(node)}-hint`}
                aria-controls={`${id}-panel`}
                aria-selected={selected?.path === node.path}
                aria-level={node.depth + 1}
                aria-expanded={
                  parents.has(node.path)
                    ? searching || expanded.has(node.path)
                    : undefined
                }
                tabIndex={
                  selected?.path === node.path ||
                  (!visible.some((item) => item.path === selected?.path) &&
                    index === 0)
                    ? 0
                    : -1
                }
                title={node.path}
                style={{
                  paddingLeft: `${10 + Math.min(node.depth, 6) * 16}px`,
                }}
                onClick={() => {
                  setSelection(node.path);
                  if (searching)
                    setExpanded((current) => {
                      const next = new Set(current);
                      const parts = node.path.split(" > ");
                      parts
                        .slice(0, -1)
                        .forEach((_, index) =>
                          next.add(parts.slice(0, index + 1).join(" > ")),
                        );
                      return next;
                    });
                  else if (parents.has(node.path)) toggleBranch(node.path);
                }}
                onKeyDown={(event) => {
                  let next =
                    event.key === "ArrowDown"
                      ? (index + 1) % visible.length
                      : event.key === "ArrowUp"
                        ? (index + visible.length - 1) % visible.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? visible.length - 1
                            : null;
                  if (event.key === "ArrowRight" && parents.has(node.path)) {
                    event.preventDefault();
                    if (!expanded.has(node.path) && !searching) {
                      toggleBranch(node.path);
                      return;
                    }
                    next = Math.min(index + 1, visible.length - 1);
                  }
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    if (expanded.has(node.path) && !searching) {
                      toggleBranch(node.path);
                      return;
                    }
                    const parentIndex = visible.findIndex(
                      (item) => item.path === node.parent,
                    );
                    if (parentIndex >= 0) next = parentIndex;
                  }
                  if (next === null) return;
                  event.preventDefault();
                  setSelection(visible[next]!.path);
                  event.currentTarget
                    .closest(".ns-category-tabs")
                    ?.querySelectorAll<HTMLButtonElement>(
                      'button[role="treeitem"]',
                    )
                    ?.[next]?.focus();
                }}
              >
                <svg
                  className="ns-category-chevron"
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  style={{
                    visibility: parents.has(node.path) ? "visible" : "hidden",
                  }}
                >
                  <path d="m7 4 6 6-6 6" />
                </svg>
                <span className="ns-category-label">
                  <span>{t(node.label)}</span>
                  <span className="ns-category-kind">
                    {t(node.depth ? "Subcategory" : "Category")}
                  </span>
                  <small id={`${id}-${nodes.indexOf(node)}-hint`}>
                    {t(
                      draft.categoryPathSavingModes[node.path] === "percentage"
                        ? "Zbritje (%)"
                        : draft.categoryPathSavingModes[node.path] === "amount"
                          ? "Kurseni (€)"
                          : "Inherited / automatic",
                    )}
                  </small>
                </span>
              </button>
            ))}
            {!visible.length && nodes.length > 0 && (
              <p>{t("No matching categories.")}</p>
            )}
          </div>
        </div>
        {selected && (
          <div
            className="ns-category-panel"
            role="region"
            id={`${id}-panel`}
            aria-labelledby={`${id}-${nodes.indexOf(selected)}`}
          >
            <small>{t(selected.depth ? "Subcategory" : "Main category")}</small>
            <nav
              className="ns-category-breadcrumb"
              aria-label={t("Selected category path")}
            >
              {selectedParts.map((part, depth) => {
                const path = selectedParts.slice(0, depth + 1).join(" > ");
                return (
                  <span key={path}>
                    {depth > 0 && <span aria-hidden="true"> › </span>}
                    <button
                      type="button"
                      aria-current={
                        path === selected.path ? "location" : undefined
                      }
                      onClick={() => {
                        setSelection(path);
                        setExpanded(
                          (current) =>
                            new Set([
                              ...current,
                              ...selectedParts
                                .slice(0, depth)
                                .map((_, index) =>
                                  selectedParts.slice(0, index + 1).join(" > "),
                                ),
                            ]),
                        );
                      }}
                    >
                      {t(part)}
                    </button>
                  </span>
                );
              })}
            </nav>
            <h3>{t(selected.label)}</h3>
            <SavingSelect
              label={`${selectedParts.map(t).join(" / ")} ${t("savings default")}`}
              inherit
              value={value}
              onChange={choose}
            />
            <p>
              {t(
                "Choose a fixed display here or inherit the parent and automatic savings rule. The brochure preview shows products from this branch when available.",
              )}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
