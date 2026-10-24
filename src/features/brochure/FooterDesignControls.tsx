import React from "react";
import type {
  Campaign,
  CampaignMutator,
  BrochureFooterDesign,
} from "../../domain/models";
import { paymentTextFor } from "./Brochure";
import { t } from "./i18n";
import { SearchableSelect } from "../../components/SearchableSelect";

export function FooterDesignControls({
  campaign,
  onUpdate,
}: {
  campaign: Campaign;
  onUpdate: (change: CampaignMutator) => void;
}) {
  const design = campaign.brochureFooter || {};
  const reference = design.style === "reference";
  const update = <K extends keyof BrochureFooterDesign>(
    key: K,
    value: BrochureFooterDesign[K],
  ) =>
    onUpdate((draft) => {
      draft.brochureFooter = { ...draft.brochureFooter, [key]: value };
      if (key === "bottom" || key === "height")
        delete draft.coverElementPlacements?.footer;
    });
  return (
    <div className="cs-footer-design-controls">
      <label>
        {t("Footer style")}
        <SearchableSelect
          value={design.style || "bar"}
          onChange={(event) =>
            update("style", event.target.value as "bar" | "reference")
          }
        >
          <option value="reference">
            {t("Reference · payment and dates")}
          </option>
          <option value="bar">{t("Orange gradient bar")}</option>
        </SearchableSelect>
      </label>
      <label className="cs-store-page-switch">
        <input
          type="checkbox"
          checked={design.visible !== false}
          onChange={(event) => update("visible", event.target.checked)}
        />
        {t("Show brochure footer")}
      </label>
      <label>
        {t("Brochure dates text")}
        <input
          value={design.dateText ?? ""}
          placeholder={t("Automatic brochure dates")}
          onChange={(event) =>
            update("dateText", event.target.value || undefined)
          }
        />
      </label>
      <label>
        {t("Footer payment text")}
        <textarea
          rows={2}
          value={paymentTextFor(campaign)}
          onChange={(event) =>
            onUpdate((draft) => {
              draft.paymentText = event.target.value;
            })
          }
        />
      </label>
      {(
        [
          ["bottom", "Distance from bottom (px)", 0, 80, 3],
          ["height", "Footer height (%)", 2, 12, reference ? 5 : 4],
          ["dateWidth", "Dates area (%)", 15, 55, 34],
          ["dateSize", "Dates text size", 0.8, 3.5, reference ? 2 : 1.9],
          ["paymentSize", "Payment text size", 0.7, 3, reference ? 2 : 1.45],
        ] as const
      )
        .filter(([key]) => !reference || key !== "dateWidth")
        .map(([key, label, min, max, fallback]) => (
          <label key={key}>
            <span>
              {t(label)} <output>{design[key] ?? fallback}</output>
            </span>
            <input
              type="range"
              aria-label={t(label)}
              min={min}
              max={max}
              step={key.endsWith("Size") ? 0.05 : 1}
              value={design[key] ?? fallback}
              onChange={(event) => update(key, Number(event.target.value))}
            />
          </label>
        ))}
      <div className="cs-two-fields">
        <label>
          {t("Orange color")}
          <input
            type="color"
            value={design.from || "#f3432b"}
            onChange={(event) => update("from", event.target.value)}
          />
        </label>
        <label>
          {t("End color")}
          <input
            type="color"
            value={design.to || "#205785"}
            onChange={(event) => update("to", event.target.value)}
          />
        </label>
      </div>
      <label>
        {t("Text color")}
        <input
          type="color"
          value={campaign.coverFooterColor || "#ffffff"}
          onChange={(event) =>
            onUpdate((draft) => {
              draft.coverFooterColor = event.target.value;
              draft.coverTextColorOverrides = {
                ...draft.coverTextColorOverrides,
                coverFooterColor: true,
              };
            })
          }
        />
      </label>
      <button
        className="cs-button secondary"
        type="button"
        onClick={() =>
          onUpdate((draft) => {
            draft.brochureFooter = reference
              ? { style: "reference" }
              : undefined;
            delete draft.coverElementPlacements?.footer;
            delete draft.paymentText;
            delete draft.coverFooterColor;
            delete draft.coverTextColorOverrides?.coverFooterColor;
          })
        }
      >
        {t("Reset footer")}
      </button>
    </div>
  );
}
