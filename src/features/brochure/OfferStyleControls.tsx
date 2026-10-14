import React from "react";
import { t } from "./i18n";
import { OFFER_STYLES, SAVING_MODES } from "./offerStyles";

interface StylePreviewProps {
  style: string;
  savingMode: string;
}

export interface OfferStyleControlsProps {
  styleValue?: string;
  savingValue?: string;
  onStyleChange: (style: string) => void;
  onSavingChange: (mode: string) => void;
  inherit?: boolean;
  inheritedStyle?: string;
  inheritedSaving?: string;
  savingInheritLabel?: string;
  scope?: "campaign" | "global" | "product";
  showSaving?: boolean;
}

function StylePreview({ style, savingMode }: StylePreviewProps) {
  const saving = savingMode === "percentage" ? "26%" : "130€";
  return (
    <span
      className={`cs-offer-style-preview preview-${style}`}
      aria-hidden="true"
    >
      <i className="mini-product" />
      <span className="mini-specs">
        <i>4K UHD</i>
        <i>55″</i>
      </span>
      <span className="mini-name">LG · TV LED</span>
      <span className="mini-regular">499€</span>
      {(style === "card" || style === "compact") && (
        <span className="mini-happy">
          Çmimi{" "}
          <img src="/api/assets/legacy/assets/happy-price-white.png" alt="" />
        </span>
      )}
      <span className="mini-price">369€</span>
      <span className="mini-badge">
        {savingMode === "percentage" ? "ZBRITJE" : "KURSENI"}
        <b>{saving}</b>
      </span>
    </span>
  );
}

export function OfferStyleControls({
  styleValue = "current",
  savingValue = "amount",
  onStyleChange,
  onSavingChange,
  inherit = false,
  inheritedStyle = "current",
  inheritedSaving = "amount",
  savingInheritLabel = "Use campaign default",
  scope = "campaign",
  showSaving = true,
}: OfferStyleControlsProps) {
  const scopeText =
    scope === "global"
      ? t(
          "Used when you create a new campaign. Existing campaigns keep their own design.",
        )
      : scope === "product"
        ? t("Changes only this product on the cover and inside pages.")
        : t(
            "Used on the cover and every inside page. Individual products can override it.",
          );
  return (
    <div className="cs-offer-style-controls">
      <p className="cs-offer-style-scope">{scopeText}</p>
      <div className="cs-offer-style-heading">
        <strong>{t("Offer card style")}</strong>
        <small>
          {t(
            "The previews use the same sample product so you can compare placement.",
          )}
        </small>
      </div>
      <div
        className="cs-offer-style-grid"
        role="group"
        aria-label={t("Offer card style")}
      >
        {inherit && (
          <button
            type="button"
            className={!styleValue ? "chosen" : ""}
            aria-pressed={!styleValue}
            onClick={() => onStyleChange("")}
          >
            <StylePreview style={inheritedStyle} savingMode={inheritedSaving} />
            <b>{t("Use campaign default")}</b>
            <small>
              {t(
                OFFER_STYLES.find((item) => item.id === inheritedStyle)?.name ||
                  "Current NEPTUN",
              )}{" "}
              ·{" "}
              {t(
                SAVING_MODES.find((item) => item.id === inheritedSaving)
                  ?.name || "Save €",
              )}
            </small>
          </button>
        )}
        {OFFER_STYLES.map((option) => (
          <button
            type="button"
            key={option.id}
            className={styleValue === option.id ? "chosen" : ""}
            aria-pressed={styleValue === option.id}
            onClick={() => onStyleChange(option.id)}
          >
            <StylePreview
              style={option.id}
              savingMode={savingValue || inheritedSaving}
            />
            <b>
              {t(option.name)}
              {styleValue === option.id && (
                <span className="cs-offer-style-selected">
                  ✓ {t("Active choice")}
                </span>
              )}
            </b>
            <small>{t(option.detail)}</small>
          </button>
        ))}
      </div>
      {showSaving && (
        <>
          <div className="cs-offer-style-heading">
            <strong>{t("Savings label")}</strong>
            <small>{t("Show the amount saved or discount percentage.")}</small>
          </div>
          <div
            className="cs-saving-mode-row"
            role="group"
            aria-label={t("Savings label")}
          >
            {inherit && (
              <button
                type="button"
                className={!savingValue ? "chosen" : ""}
                aria-pressed={!savingValue}
                onClick={() => onSavingChange("")}
              >
                {t(savingInheritLabel)} ·{" "}
                {t(
                  SAVING_MODES.find((item) => item.id === inheritedSaving)
                    ?.name || "Save €",
                )}
              </button>
            )}
            {SAVING_MODES.map((option) => (
              <button
                type="button"
                key={option.id}
                className={savingValue === option.id ? "chosen" : ""}
                aria-pressed={savingValue === option.id}
                onClick={() => onSavingChange(option.id)}
              >
                {t(option.name)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
