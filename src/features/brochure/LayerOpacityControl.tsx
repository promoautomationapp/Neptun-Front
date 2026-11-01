import React, { useEffect, useId, useState } from "react";
import { t } from "./i18n";
import "../../styles/layer-opacity-control.css";

const percentOf = (value: number) =>
  Math.round(
    Math.min(1, Math.max(0, Number.isFinite(value) ? value : 1)) * 100,
  );

export function LayerOpacityControl({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}) {
  const percent = percentOf(value);
  const [draft, setDraft] = useState(String(percent));
  const descriptionId = useId();
  useEffect(() => setDraft(String(percent)), [percent]);
  const controlLabel = label || t("Opacity");
  function apply(next: number) {
    const bounded = Math.round(Math.min(100, Math.max(0, next)));
    setDraft(String(bounded));
    onChange(bounded / 100);
  }
  return (
    <fieldset className="cs-layer-opacity">
      <legend>{controlLabel}</legend>
      <div className="cs-layer-opacity-controls">
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={percent}
          aria-label={controlLabel}
          aria-valuetext={`${percent}%`}
          aria-describedby={descriptionId}
          style={
            { "--layer-opacity-percent": `${percent}%` } as React.CSSProperties
          }
          onChange={(event) => apply(Number(event.target.value))}
        />
        <label className="cs-layer-opacity-value">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max="100"
            step="1"
            value={draft}
            aria-label={`${controlLabel} (%)`}
            onChange={(event) => {
              const next = event.target.value;
              setDraft(next);
              const number = Number(next);
              if (
                next !== "" &&
                Number.isFinite(number) &&
                number >= 0 &&
                number <= 100
              )
                onChange(number / 100);
            }}
            onBlur={() => {
              if (draft.trim() && Number.isFinite(Number(draft)))
                apply(Number(draft));
              else setDraft(String(percent));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          />
          <span aria-hidden="true">%</span>
        </label>
      </div>
      <div className="cs-layer-opacity-scale" id={descriptionId}>
        <span>0% · {t("Transparent")}</span>
        <span>100% · {t("Solid")}</span>
      </div>
      <div
        className="cs-layer-opacity-presets"
        role="group"
        aria-label={t("Opacity presets")}
      >
        {[0, 50, 100].map((preset) => (
          <button
            type="button"
            key={preset}
            aria-label={`${t("Set opacity")}: ${preset}%`}
            aria-pressed={percent === preset}
            onClick={() => apply(preset)}
          >
            {preset}%
          </button>
        ))}
      </div>
    </fieldset>
  );
}
