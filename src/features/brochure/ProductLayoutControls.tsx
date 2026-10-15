import React from "react";
import type { Campaign, Product } from "../../domain/models";
import {
  resolveScreenAnnotationPlacement,
  usesPhoneCornerAnnotation,
} from "./screenAnnotationGeometry";
import { defaultProductDetailPlacement } from "./mobileDetails";
import {
  otherScreenInches,
  tvScreenInches,
} from "./tvSpecs";
import { t } from "./i18n";
import { defaultPhotoPlacement } from "../settings/product-design-defaults";
import "../../styles/product-layout-controls.css";

export function ProductLayoutControls({
  product,
  campaign,
  onChange,
}: {
  product: Product;
  campaign: Partial<Campaign>;
  onChange: (field: keyof Product, value: Product[keyof Product]) => void;
}) {
  const photo = {
    ...defaultPhotoPlacement(product, campaign, defaultProductDetailPlacement(product, campaign)),
    ...product.brochureImagePlacement,
  };
  const annotationType = tvScreenInches(product)
    ? "television"
    : usesPhoneCornerAnnotation(product)
      ? "phone"
      : "other";
  const resolved = resolveScreenAnnotationPlacement(
    annotationType,
    product.screenAnnotationPlacement,
  );
  const annotation = {
    ...resolved,
    horizontalLength: resolved.horizontalLength ?? 1,
    verticalLength: resolved.verticalLength ?? 1,
  };
  const inches = tvScreenInches(product) || otherScreenInches(product);
  function field(
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    save: (value: number) => void,
  ) {
    return (
      <label>
        <span>{t(label)}</span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            if (event.target.value !== "")
              save(Math.max(min, Math.min(max, Number(event.target.value))));
          }}
        />
      </label>
    );
  }
  return (
    <section className="cs-product-layout-controls">
      <h4>{t("Position & size")}</h4>
      <label className="cs-details-placement">
        <span>{t("Product details")}</span>
        <select
          value={defaultProductDetailPlacement(product, campaign)}
          onChange={(event) => onChange("detailPlacement", event.target.value)}
        >
          <option value="left">{t("Left of image")}</option>
          <option value="bottom">{t("Below image")}</option>
        </select>
      </label>
      <p>
        {t(
          "Drag the details handle to the left or bottom of the photo. Move, resize or delete each block on the page.",
        )}
      </p>
      <strong>{t("Product photo")}</strong>
      <div className="cs-product-layout-fields">
        {field("Left (%)", photo.x, 0, 100, 1, (x) =>
          onChange("brochureImagePlacement", { ...photo, x }),
        )}
        {field("Top (%)", photo.y, 0, 100, 1, (y) =>
          onChange("brochureImagePlacement", { ...photo, y }),
        )}
        {field(
          "Size (%)",
          Math.round(photo.scale * 100),
          20,
          250,
          5,
          (scale: number) =>
            onChange("brochureImagePlacement", {
              ...photo,
              scale: scale / 100,
            }),
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange("brochureImagePlacement", null)}
      >
        {t("Reset photo position")}
      </button>
      {inches && (
        <>
          <strong>{t("Inch label & lines")}</strong>
          <div className="cs-product-layout-fields">
            {field("Horizontal offset", annotation.x, -50, 50, 0.5, (x) =>
              onChange("screenAnnotationPlacement", { ...annotation, x }),
            )}
            {field("Vertical offset", annotation.y, -50, 50, 0.5, (y) =>
              onChange("screenAnnotationPlacement", { ...annotation, y }),
            )}
            {field(
              "Size (%)",
              Math.round(annotation.scale * 100),
              25,
              250,
              5,
              (scale: number) =>
                onChange("screenAnnotationPlacement", {
                  ...annotation,
                  scale: scale / 100,
                }),
            )}
            {annotationType === "other" && (
              <>
                {field(
                  "Horizontal line (%)",
                  Math.round(annotation.horizontalLength * 100),
                  0,
                  300,
                  10,
                  (v: number) =>
                    onChange("screenAnnotationPlacement", {
                      ...annotation,
                      horizontalLength: v / 100,
                    }),
                )}
                {field(
                  "Vertical line (%)",
                  Math.round(annotation.verticalLength * 100),
                  0,
                  300,
                  10,
                  (v: number) =>
                    onChange("screenAnnotationPlacement", {
                      ...annotation,
                      verticalLength: v / 100,
                    }),
                )}
              </>
            )}
          </div>
          <label className="cs-details-placement">
            <span>{t("Show inch label")}</span>
            <input
              type="checkbox"
              checked={!annotation.hidden}
              onChange={(event) =>
                onChange("screenAnnotationPlacement", {
                  ...annotation,
                  hidden: !event.target.checked,
                })
              }
            />
          </label>
          <button
            type="button"
            onClick={() => onChange("screenAnnotationPlacement", null)}
          >
            {t("Reset inch label & lines")}
          </button>
        </>
      )}
    </section>
  );
}
