import React, { useState } from "react";
import type { Product, Campaign } from "../../domain/models";
import { installmentCount, money } from "./Brochure";
import { Button, Field, Modal } from "./Modals";
import { savingModeFor } from "./offerStyles";
import { t } from "./i18n";

export function ProductPriceEditor({
  product,
  campaign,
  focusSavings = false,
  onSave,
  onClose,
}: {
  product: Product;
  campaign: Campaign;
  focusSavings?: boolean;
  onSave: (
    changes: Pick<
      Product,
      "regular" | "sale" | "savingMode" | "confirmedAboveRegular"
    >,
  ) => void;
  onClose: () => void;
}) {
  const [regular, setRegular] = useState(String(product.regular ?? ""));
  const [sale, setSale] = useState(String(product.sale ?? ""));
  const [savingMode, setSavingMode] = useState(
    savingModeFor(campaign, product),
  );
  const [confirmedHigher, setConfirmedHigher] = useState(
    Boolean(product.confirmedAboveRegular),
  );
  const regularAmount = Number(regular);
  const saleAmount = Number(sale);
  const hasRegular = Number.isFinite(regularAmount) && regularAmount > 0;
  const regularOptional =
    (product.catalogMissing || product.source === "import") && !regular.trim();
  const valid =
    (hasRegular || regularOptional) &&
    Number.isFinite(saleAmount) &&
    saleAmount > 0;
  const higher = valid && hasRegular && saleAmount > regularAmount;
  const saving =
    valid && saleAmount < regularAmount ? regularAmount - saleAmount : 0;
  const percent = saving ? Math.round((saving / regularAmount) * 100) : 0;
  const installments = installmentCount(campaign);
  return (
    <Modal
      title={t("Edit price and savings")}
      kicker={`${product.brand || "PRODUCT"} · ${product.code}`}
      onClose={onClose}
    >
      <div className="cs-price-editor">
        <strong>{product.name}</strong>
        <div className="cs-price-editor-fields">
          <Field label={t("Regular price (€)")}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={regular}
              onChange={(event) => setRegular(event.target.value)}
            />
          </Field>
          <Field label={t("New offer price (€)")}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={sale}
              onChange={(event) => {
                setSale(event.target.value);
                setConfirmedHigher(false);
              }}
              autoFocus={!focusSavings}
            />
          </Field>
        </div>
        <div className="cs-price-editor-preview" aria-live="polite">
          <span>
            {t("Regular price")}{" "}
            <del>{hasRegular ? `${money(regularAmount)} €` : "—"}</del>
          </span>
          <span>
            {t("Sale price")} <b>{valid ? `${money(saleAmount)} €` : "—"}</b>
          </span>
          <span>
            {installments} {t("installments")}{" "}
            <b>{valid ? `${money(saleAmount / installments)} €` : "—"}</b>
          </span>
        </div>
        <div className="cs-price-editor-saving">
          <strong>{t("Savings badge in brochure")}</strong>
          <p>{t("Choose which label and value appear for this product.")}</p>
          <div role="group" aria-label={t("Savings badge in brochure")}>
            <button
              type="button"
              className={savingMode === "amount" ? "chosen" : ""}
              disabled={!saving}
              onClick={() => setSavingMode("amount")}
              autoFocus={focusSavings && Boolean(saving)}
            >
              {t("Kurseni")} <b>{saving ? `${money(saving)} €` : "—"}</b>
            </button>
            <button
              type="button"
              className={savingMode === "percentage" ? "chosen" : ""}
              disabled={!saving}
              onClick={() => setSavingMode("percentage")}
            >
              {t("Zbritje")} <b>{saving ? `${percent}%` : "—"}</b>
            </button>
          </div>
          {!saving && (
            <small>
              {t(
                "A savings badge appears when the offer price is lower than the regular price.",
              )}
            </small>
          )}
        </div>
        {higher && (
          <label className="cs-price-editor-confirm">
            <input
              type="checkbox"
              checked={confirmedHigher}
              onChange={(event) => setConfirmedHigher(event.target.checked)}
            />
            {t("Confirm price above regular")}
          </label>
        )}
        {!valid && (
          <p className="cs-price-editor-error" role="alert">
            {t("Enter valid regular and offer prices.")}
          </p>
        )}
      </div>
      <div className="cs-modal-actions">
        <Button onClick={onClose}>{t("Cancel")}</Button>
        <Button
          tone="primary"
          disabled={!valid || (higher && !confirmedHigher)}
          onClick={() => {
            onSave({
              regular: hasRegular ? regularAmount : null,
              sale: saleAmount,
              savingMode,
              confirmedAboveRegular: higher && confirmedHigher,
            });
            onClose();
          }}
        >
          {t("Save price")}
        </Button>
      </div>
    </Modal>
  );
}
