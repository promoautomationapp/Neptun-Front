import React, { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Product } from "../../domain/models";
import { t } from "./i18n";
import { normalizeSearch, matchesSearch } from "./searchText";

export interface CategoryTreeSelectProps {
  catalog: readonly Product[];
  category: string;
  subcategory: string;
  onChange: (category: string, subcategory: string) => void;
}

interface CategoryGroup {
  name: string;
  count: number;
  children: Map<string, number>;
}

export function CategoryTreeSelect({
  catalog,
  category,
  subcategory,
  onChange,
}: CategoryTreeSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const options = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => {
    const byCategory = new Map<string, CategoryGroup>();
    for (const product of catalog) {
      if (!product.category) continue;
      let group = byCategory.get(product.category);
      if (!group) {
        group = { name: product.category, count: 0, children: new Map() };
        byCategory.set(product.category, group);
      }
      group.count += 1;
      if (product.subcategory)
        group.children.set(
          product.subcategory,
          (group.children.get(product.subcategory) || 0) + 1,
        );
    }
    return [...byCategory.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((group) => ({
        name: group.name,
        count: group.count,
        children: [...group.children].sort(([a], [b]) => a.localeCompare(b)),
      }));
  }, [catalog]);
  const term = normalizeSearch(query);
  const visible = groups
    .map((group) => {
      const parentMatch = matchesSearch(`${group.name} ${t(group.name)}`, term);
      const children =
        term && !parentMatch
          ? group.children.filter(([name]) =>
              matchesSearch(`${name} ${t(name)}`, term),
            )
          : group.children;
      return parentMatch || children.length ? { ...group, children } : null;
    })
    .filter((group) => group !== null);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (
        !root.current?.contains(
          event.target instanceof Node ? event.target : null,
        )
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

  function choose(nextCategory: string, nextSubcategory: string) {
    onChange(nextCategory, nextSubcategory);
    setOpen(false);
    setQuery("");
    trigger.current?.focus();
  }
  function keyNavigation(
    event: ReactKeyboardEvent<HTMLDivElement | HTMLInputElement>,
  ) {
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

  return (
    <div className={`cs-category-select ${open ? "is-open" : ""}`} ref={root}>
      <span className="cs-filter-label">{t("Category & subcategory")}</span>
      <button
        className="cs-category-trigger"
        type="button"
        ref={trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setQuery("");
          setOpen((value) => !value);
        }}
      >
        <span className="cs-category-trigger-text">
          <strong>
            {subcategory
              ? t(subcategory)
              : category
                ? t(category)
                : t("All categories")}
          </strong>
          {subcategory && <small>{t(category)}</small>}
        </span>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 7 5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div
          className="cs-category-popover"
          role="dialog"
          aria-label={t("Category & subcategory")}
        >
          <div className="cs-category-search">
            <span aria-hidden="true">⌕</span>
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
            {!term && (
              <button
                className="cs-category-all"
                type="button"
                aria-pressed={!category}
                onClick={() => choose("", "")}
              >
                {t("All categories")}
                <span>{catalog.length}</span>
              </button>
            )}
            {visible.map((group) => (
              <div className="cs-category-group" key={group.name}>
                <button
                  type="button"
                  className="cs-category-parent"
                  aria-pressed={category === group.name && !subcategory}
                  onClick={() => choose(group.name, "")}
                >
                  <span>
                    <strong>{t(group.name)}</strong>
                    <small>{t("All products in this category")}</small>
                  </span>
                  <b>{group.count}</b>
                </button>
                {group.children.map(([name, count]) => (
                  <button
                    type="button"
                    className="cs-category-child"
                    key={`${group.name}/${name}`}
                    aria-pressed={
                      category === group.name && subcategory === name
                    }
                    onClick={() => choose(group.name, name)}
                  >
                    <span>{t(name)}</span>
                    <b>{count}</b>
                  </button>
                ))}
              </div>
            ))}
            {!visible.length && (
              <p className="cs-category-empty">{t("No matching categories")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
