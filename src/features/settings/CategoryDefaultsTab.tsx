import { SettingsGroup } from "./components";
import { useEffect, useId, useMemo, useState } from "react";
import { Field, Toggle } from "./components";
import { SavingSelect } from "./OffersTab";
import type { SettingsTabProps } from "./SettingsEditor";
import { categoryNodes, type CategoryFacet } from "./categoryHierarchy";
import { resolvedSavingsMode } from "./savingsPolicy";
import { matchesSearch } from "../brochure/searchText";

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
      matchesSearch(item.path, query),
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
      <h2>Category and subcategory defaults</h2>
      <p>
        Open a main category to see its subcategories. Smaller offers use
        Zbritje (%) automatically. Category choices override their parent;
        product edits take priority.
      </p>
      <SettingsGroup
        title={<> Automatic savings for small and large offers </>}
      >
        <Toggle
          label="Use percentage for small savings and euros for larger savings"
          checked={draft.automaticSavings.enabled}
          onChange={(enabled) =>
            update((next) => {
              next.automaticSavings.enabled = enabled;
            })
          }
        />
        <Field
          label="Show saved euros from this amount"
          hint="Below this amount, show Zbritje (%). At or above it, show Kurseni (€), unless a category or product overrides it."
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
          aria-label="Automatic savings examples"
        >
          <div>
            <small>€10 saved</small>
            <strong>{example(50, 40)}</strong>
            <span>€50 → €40</span>
          </div>
          <div>
            <small>€100 saved</small>
            <strong>{example(499, 399)}</strong>
            <span>€499 → €399</span>
          </div>
        </div>
      </SettingsGroup>
      {facetsError && (
        <p role="alert">
          {facetsError} Saved category choices remain available.
        </p>
      )}
      {!nodes.length && (
        <p>
          No catalog categories yet. Fetch products from neptun-ks.com to load
          the hierarchy.
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
            {expanded.size > 0 && !searching && (
              <button
                type="button"
                className="ns-category-collapse"
                onClick={() => {
                  setExpanded(new Set());
                  setSelection(selected?.path.split(" > ")[0] || "");
                }}
              >
                Collapse all
              </button>
            )}
          </div>
          <div
            className="ns-category-tabs"
            role="tree"
            aria-label="Categories and subcategories"
          >
            {visible.map((node, index) => (
              <button
                type="button"
                role="treeitem"
                key={node.path}
                id={`${id}-${nodes.indexOf(node)}`}
                aria-label={node.label}
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
                  <span>{node.label}</span>
                  <small id={`${id}-${nodes.indexOf(node)}-hint`}>
                    {draft.categoryPathSavingModes[node.path] === "percentage"
                      ? "Zbritje (%)"
                      : draft.categoryPathSavingModes[node.path] === "amount"
                        ? "Kurseni (€)"
                        : "Inherited / automatic"}
                  </small>
                </span>
              </button>
            ))}
            {!visible.length && nodes.length > 0 && (
              <p>No matching categories.</p>
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
            <small>{selected.parent || "Main category"}</small>
            <h3>{selected.label}</h3>
            <SavingSelect
              label={`${selected.path.replaceAll(" > ", " / ")} savings default`}
              inherit
              value={value}
              onChange={choose}
            />
            <p>
              Choose a fixed display here or inherit the parent and automatic
              savings rule. The brochure preview shows products from this branch
              when available.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
