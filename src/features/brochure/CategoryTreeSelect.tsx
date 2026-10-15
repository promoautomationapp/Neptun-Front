import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Product } from "../../domain/models";
import { t } from "./i18n";
import { normalizeSearch, matchesSearch } from "./searchText";
import {
  type CategoryNode,
  categoryNodes,
  categorySegments,
  productCategoryPath,
} from "../settings/categoryHierarchy";

export interface CategoryTreeSelectProps {
  catalog: readonly Product[];
  category: string;
  subcategory: string;
  onChange: (category: string, subcategory: string) => void;
  categoryPath?: string;
  onPathChange?: (path: string) => void;
  sourcePaths?: readonly string[];
  label?: string;
  placeholder?: string;
  includeAll?: boolean;
}

export function CategoryTreeSelect({
  catalog,
  category,
  subcategory,
  onChange,
  categoryPath,
  onPathChange,
  sourcePaths,
  label = t("Category & subcategory"),
  placeholder = t("All categories"),
  includeAll = true,
}: CategoryTreeSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const root = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<React.CSSProperties>({});
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const options = useRef<HTMLDivElement>(null);
  const { nodes, counts } = useMemo(() => {
    const facets = catalog.map((product) => ({
      category: product.category || "",
      subcategory: product.subcategory || "",
      categoryPath: product.categoryPath,
    }));
    const counts = new Map<string, number>();
    for (const product of catalog) {
      const parts = categorySegments(productCategoryPath(product));
      parts.forEach((_part, depth) => {
        const path = parts.slice(0, depth + 1).join(" > ");
        counts.set(path, (counts.get(path) || 0) + 1);
      });
    }
    return {
      nodes: categoryNodes(
        sourcePaths?.length ? [] : facets,
        sourcePaths ? [...sourcePaths] : [],
      ),
      counts,
    };
  }, [catalog, sourcePaths]);
  const selectedPath =
    categoryPath !== undefined
      ? categoryPath
      : subcategory
        ? nodes.find(
            (node) =>
              categorySegments(node.path)[0] === category &&
              node.label === subcategory,
          )?.path || [category, subcategory].filter(Boolean).join(" > ")
        : category;
  const selectedParts = categorySegments(selectedPath);
  const translatedPath = (path: string) =>
    categorySegments(path).map(t).join(" > ");
  const term = normalizeSearch(query);
  const matched = nodes.filter((node) =>
    matchesSearch(`${node.path} ${translatedPath(node.path)}`, term),
  );
  const branches = new Set(nodes.map((node) => node.parent));
  const visible = nodes.filter((node) => {
    if (term)
      return matched.some(
        (match) =>
          match.path === node.path || match.path.startsWith(`${node.path} > `),
      );
    const ancestors = categorySegments(node.parent);
    return ancestors.every((_part, depth) =>
      expanded.has(ancestors.slice(0, depth + 1).join(" > ")),
    );
  });
  function showPicker() {
    setQuery("");
    setExpanded(
      new Set(
        selectedParts.map((_part, depth) =>
          selectedParts.slice(0, depth + 1).join(" > "),
        ),
      ),
    );
    setOpen(true);
  }
  const groups = visible
    .filter((node) => !node.parent)
    .map((parent) => ({
      parent,
      children: visible.filter((node) =>
        node.path.startsWith(`${parent.path} > `),
      ),
    }));

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target) &&
        !popover.current?.contains(event.target)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 420), window.innerWidth - 24);
      const below = window.innerHeight - rect.bottom - 16,
        above = rect.top - 16;
      const flip = below < 260 && above > below;
      setPlacement({
        position: "fixed",
        width,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        ...(flip
          ? { bottom: window.innerHeight - rect.top + 5 }
          : { top: rect.bottom + 5 }),
        maxHeight: Math.min(480, Math.max(160, flip ? above : below)),
      });
    };
    place();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [open]);
  function choose(path: string) {
    const parts = categorySegments(path);
    onChange(parts[0] || "", parts.length > 1 ? parts.at(-1) || "" : "");
    onPathChange?.(path);
    setOpen(false);
    setQuery("");
    trigger.current?.focus();
  }
  function keyNavigation(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (event.target === search.current && event.key === "Enter") {
      event.preventDefault();
      const candidate =
        matched.find((node) => matchesSearch(node.label, term)) || matched[0];
      if (candidate) choose(candidate.path);
      return;
    }
    if (
      (event.key === "Home" || event.key === "End") &&
      event.target === search.current
    )
      return;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = [...(options.current?.querySelectorAll("button") || [])];
    if (!buttons.length) return;
    event.preventDefault();
    const current = buttons.findIndex(
      (button) => button === document.activeElement,
    );
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : event.key === "ArrowDown"
            ? Math.min(current + 1, buttons.length - 1)
            : Math.max(current - 1, 0);
    buttons[next]?.focus();
  }

  function renderNode(node: CategoryNode) {
    const hasChildren = branches.has(node.path);
    return (
      <div
        className={`cs-category-tree-row${node.depth ? " is-child" : ""}`}
        key={node.path}
        style={{ paddingLeft: node.depth * 13 }}
      >
        <button
          type="button"
          className={node.depth ? "cs-category-child" : "cs-category-parent"}
          aria-pressed={selectedPath === node.path}
          aria-label={`${translatedPath(node.path)} · ${counts.get(node.path) || 0} ${t("products")}`}
          onClick={() => choose(node.path)}
        >
          <span>
            <strong>{t(node.label)}</strong>
            {term && node.parent && (
              <small>{translatedPath(node.parent)}</small>
            )}
          </span>
          <b>{counts.get(node.path) || 0}</b>
        </button>
        {hasChildren && !term && (
          <button
            className="cs-category-expand"
            type="button"
            aria-label={`${t("Show subcategories")}: ${translatedPath(node.path)}`}
            aria-expanded={expanded.has(node.path)}
            onClick={() =>
              setExpanded((current) => {
                const next = new Set(current);
                if (next.has(node.path)) next.delete(node.path);
                else next.add(node.path);
                return next;
              })
            }
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m7 5 5 5-5 5" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`cs-category-select ${open ? "is-open" : ""}`} ref={root}>
      <span className="cs-filter-label">{label}</span>
      <button
        className="cs-category-trigger"
        type="button"
        ref={trigger}
        aria-haspopup="dialog"
        aria-label={label}
        title={translatedPath(selectedPath) || placeholder}
        aria-expanded={open}
        onKeyDown={(event) => {
          if (open) keyNavigation(event);
          else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            showPicker();
          }
        }}
        onClick={() => {
          if (open) setOpen(false);
          else showPicker();
        }}
      >
        <span className="cs-category-trigger-text">
          <strong>
            {selectedParts.length
              ? t(selectedParts.at(-1)!)
              : placeholder}
          </strong>
          {selectedParts.length > 1 && (
            <small>{selectedParts.slice(0, -1).map(t).join(" > ")}</small>
          )}
        </span>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 7 5 5 5-5" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={popover}
            style={placement}
            className="cs-category-popover cs-category-portal"
            role="dialog"
            aria-label={label}
          >
            <div className="cs-category-search">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m12.5 12.5 4.5 4.5" />
              </svg>
              <input
                ref={search}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={keyNavigation}
                placeholder={t("Search categories or subcategories…")}
                aria-label={t("Search categories or subcategories…")}
              />
            </div>
            <div
              className="cs-category-options"
              ref={options}
              onKeyDown={keyNavigation}
            >
              {!term && includeAll && (
                <button
                  className="cs-category-all"
                  type="button"
                  aria-pressed={!selectedPath}
                  onClick={() => choose("")}
                >
                  {t("All categories")}
                  <span>{catalog.length}</span>
                </button>
              )}
              {groups.map(({ parent, children }) => (
                <div className="cs-category-group" key={parent.path}>
                  {renderNode(parent)}
                  {children.map(renderNode)}
                </div>
              ))}
              {!visible.length && (
                <p className="cs-category-empty">
                  {t("No matching categories")}
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
