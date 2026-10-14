import React from "react";
import { BROCHURE_LAYOUTS, layoutGrid } from "./brochureLayout";
import { t } from "./i18n";

export function BrochureGridPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = ["grid4", "duo", "feature"].includes(value) ? "duo4" : value;
  return (
    <div
      className="cs-layout-options compact-grid"
      role="group"
      aria-label={t("Page layout")}
    >
      {BROCHURE_LAYOUTS.map((option) => {
        const { columns, rows } = layoutGrid(option.id);
        return (
          <button
            key={option.id}
            type="button"
            className={selected === option.id ? "chosen" : ""}
            aria-pressed={selected === option.id}
            title={t(option.detail)}
            onClick={() => onChange(option.id)}
          >
            <span
              className={`cs-layout-glyph ${option.id}`}
              style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
              aria-hidden="true"
            >
              {Array.from({ length: rows * columns }, (_, index) => (
                <i
                  key={index}
                  className={index >= option.capacity ? "empty" : ""}
                />
              ))}
            </span>
            <span>
              <strong>
                {t(
                  option.id === "duo4"
                    ? "Two products per row"
                    : `${option.capacity} offers`,
                )}
              </strong>
              <small>
                {option.id === "duo4" ? `${t("4 offers")} · ` : ""}
                {columns} × {rows}
              </small>
            </span>
            <b className="cs-layout-check" aria-hidden="true">
              ✓
            </b>
          </button>
        );
      })}
    </div>
  );
}
