import React from "react";
import { BROCHURE_LAYOUTS, cardSize, layoutGrid } from "./brochureLayout";
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
        const balanced = option.id === "tv8" || option.id === "balanced8";
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
              {Array.from(
                { length: balanced ? option.capacity : rows * columns },
                (_, index) => (
                  <i
                    key={index}
                    className={index >= option.capacity ? "empty" : ""}
                    style={
                      balanced
                        ? {
                            gridColumn: `span ${cardSize({}, option.id, index).width}`,
                          }
                        : undefined
                    }
                  />
                ),
              )}
            </span>
            <span>
              <strong>
                {t(
                  option.id === "duo4"
                    ? "Two products per row"
                    : balanced
                      ? option.name
                      : `${option.capacity} offers`,
                )}
              </strong>
              <small>
                {option.id === "duo4" ? `${t("4 offers")} · ` : ""}
                {balanced ? "3–2–3" : `${columns} × ${rows}`}
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
