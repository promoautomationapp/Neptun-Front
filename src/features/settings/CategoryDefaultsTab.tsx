import { SettingsGroup } from "./components";
import { useEffect, useId, useMemo, useState } from "react";
import { Field, Toggle } from "./components";
import { SavingSelect } from "./OffersTab";
import type { SettingsTabProps } from "./SettingsEditor";
import { categoryNodes, type CategoryFacet } from "./categoryHierarchy";
import { resolvedSavingsMode } from "./savingsPolicy";

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
  const selected = nodes.find((node) => node.path === selection) || nodes[0];
  const id = useId();
  useEffect(() => {
    onPreviewCategory(selected?.path || "");
  }, [selected?.path, onPreviewCategory]);
  const visible = nodes.filter((node) =>
    node.path.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
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
        Each level has its own tab. More specific choices override their parent.
        Product edits always take priority.
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
      <Field label="Find category or subcategory">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </Field>
      {!nodes.length && (
        <p>
          No catalog categories yet. Fetch products from neptun-ks.com to load
          the hierarchy.
        </p>
      )}
      <div className="ns-category-workspace">
        <div
          className="ns-category-tabs"
          role="tablist"
          aria-label="Category and subcategory tabs"
          aria-orientation="vertical"
        >
          {visible.map((node, index) => (
            <button
              type="button"
              role="tab"
              key={node.path}
              id={`${id}-${nodes.indexOf(node)}`}
              aria-controls={`${id}-panel`}
              aria-selected={selected?.path === node.path}
              tabIndex={
                selected?.path === node.path ||
                (!visible.some((item) => item.path === selected?.path) &&
                  index === 0)
                  ? 0
                  : -1
              }
              title={node.path}
              style={{ paddingLeft: `${12 + Math.min(node.depth, 6) * 12}px` }}
              onClick={() => setSelection(node.path)}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowDown"
                    ? (index + 1) % visible.length
                    : event.key === "ArrowUp"
                      ? (index + visible.length - 1) % visible.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? visible.length - 1
                          : null;
                if (next === null) return;
                event.preventDefault();
                setSelection(visible[next]!.path);
                event.currentTarget.parentElement
                  ?.querySelectorAll<HTMLButtonElement>('button[role="tab"]')
                  [next]?.focus();
              }}
            >
              <span>
                {node.depth ? "↳ " : ""}
                {node.label}
              </span>
              <small>
                {draft.categoryPathSavingModes[node.path] === "percentage"
                  ? "Zbritje (%)"
                  : draft.categoryPathSavingModes[node.path] === "amount"
                    ? "Kurseni (€)"
                    : "Inherited / automatic"}
              </small>
            </button>
          ))}
          {!visible.length && nodes.length > 0 && (
            <p>No matching categories.</p>
          )}
        </div>
        {selected && (
          <div
            className="ns-category-panel"
            role="tabpanel"
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
