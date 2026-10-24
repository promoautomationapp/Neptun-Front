import React, { useEffect, useRef, useState } from "react";
import type { Campaign, Product } from "../../domain/models";
import { savingModeFor } from "./offerStyles";
import { t } from "./i18n";

const money = (amount: number) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(amount);
const savingsSelector =
  ".brochure-saving,.red-reference-saving,.reference-saving-tab";

export function InlinePriceEditor({
  product,
  onSave,
  onClose,
}: {
  product: Product;
  onSave: (changes: Partial<Product>) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [regular, setRegular] = useState(String(product.regular ?? ""));
  const [sale, setSale] = useState(String(product.sale ?? ""));
  const [confirmed, setConfirmed] = useState(
    Boolean(product.confirmedAboveRegular),
  );
  const regularValue = Number(regular),
    saleValue = Number(sale);
  const optionalRegular =
    (product.catalogMissing || product.source === "import") && !regular.trim();
  const higher = regularValue > 0 && saleValue > regularValue;
  const valid =
    (regularValue > 0 || optionalRegular) &&
    saleValue > 0 &&
    Number.isFinite(regularValue) &&
    Number.isFinite(saleValue) &&
    (!higher || confirmed);
  const save = () => {
    if (!valid) return;
    if (
      regularValue !== Number(product.regular) ||
      saleValue !== Number(product.sale) ||
      higher !== Boolean(product.confirmedAboveRegular)
    )
      onSave({
        regular: optionalRegular ? null : regularValue,
        sale: saleValue,
        confirmedAboveRegular: higher && confirmed,
      });
    onClose();
  };
  const latestSave = useRef(save);
  latestSave.current = save;
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target))
        latestSave.current();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, []);
  const saving =
    regularValue > saleValue && saleValue > 0 ? regularValue - saleValue : 0;
  return (
    <form
      ref={ref}
      className="cs-inline-price-editor"
      role="dialog"
      aria-label={t("Edit price here")}
      data-export-hide="true"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header>
        <strong>{t("Edit price here")}</strong>
        <button type="button" aria-label={t("Cancel")} onClick={onClose}>
          ×
        </button>
      </header>
      <label>
        {t("Regular price (€)")}
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={regular}
          onChange={(event) => setRegular(event.target.value)}
        />
      </label>
      <label>
        {t("New offer price (€)")}
        <input
          autoFocus
          type="number"
          min="0.01"
          step="0.01"
          value={sale}
          onChange={(event) => {
            setSale(event.target.value);
            setConfirmed(false);
          }}
        />
      </label>
      <output aria-live="polite">
        {t("Kurseni")} {money(saving)} € · {t("Discount")}{" "}
        {saving && regularValue > 0
          ? Math.round((saving / regularValue) * 100)
          : 0}
        %
      </output>
      {higher && (
        <label className="cs-inline-price-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          {t("Confirm price above regular price")}
        </label>
      )}
      <button type="submit" disabled={!valid}>
        {t("Save")}
      </button>
    </form>
  );
}

/** Capture before native price/SVG handlers so clicks edit in place and two clicks toggle savings. */
export function useProductQuickEdit({
  campaign,
  product,
  onChange,
  onEditImage,
}: {
  campaign: Campaign;
  product: Product;
  onChange?: (changes: Partial<Product>) => void;
  onEditImage?: (product: Product) => void;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const events: React.HTMLAttributes<HTMLElement> =
    !onChange && !onEditImage
      ? {}
      : {
          onClickCapture: (event) => {
            if (!onChange) return;
            const target = event.target as Element;
            if (
              target.closest(
                ".cs-inline-price-editor,button,input,[data-export-hide='true']",
              )
            )
              return;
            const badge = target.closest(savingsSelector);
            if (
              !badge &&
              !target.closest(
                ".brochure-price,.reference-price-card,.red-reference-price",
              )
            )
              return;
            event.preventDefault();
            event.stopPropagation();
            clear();
            if (badge) {
              if (event.detail < 2)
                timer.current = setTimeout(() => setEditingPrice(true), 350);
            } else setEditingPrice(true);
          },
          onDoubleClickCapture: (event) => {
            const target = event.target as Element;
            if (
              target.closest(
                "input,button,[contenteditable='true'],.cs-inline-price-editor",
              )
            )
              return;
            if (onChange && target.closest(savingsSelector)) {
              event.preventDefault();
              event.stopPropagation();
              clear();
              setEditingPrice(false);
              onChange({
                savingMode:
                  savingModeFor(campaign, product) === "percentage"
                    ? "amount"
                    : "percentage",
              });
            } else if (
              target.closest(
                ".brochure-product-image,.product-artwork-item img,.large-bundle-photo-area img",
              )
            ) {
              event.preventDefault();
              event.stopPropagation();
              onEditImage?.(product);
            }
          },
        };
  return {
    events,
    editor:
      editingPrice && onChange ? (
        <InlinePriceEditor
          key={product.code}
          product={product}
          onSave={onChange}
          onClose={() => setEditingPrice(false)}
        />
      ) : null,
  };
}
