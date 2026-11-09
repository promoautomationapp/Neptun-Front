import React from "react";
import type { Campaign, Product } from "../../domain/models";
import { brandLogoFor } from "./brandLogos";
import { brandLogoAppearance, type BrandLogoMode } from "./brandLogoAppearance";
import { pageBackgroundFill } from "./pageBackground";
import { t } from "./i18n";
import "../../styles/brand-logo-appearance.css";

function previewBrands(
  campaign: Partial<Campaign>,
  products: readonly Product[],
) {
  const brands = new Map<string, { name: string; source: string }>();
  for (const product of products) {
    const name = String(product.brand || "").trim();
    if (!name || brands.has(name.toUpperCase())) continue;
    brands.set(name.toUpperCase(), {
      name,
      source: product.brandLogo || brandLogoFor(campaign, name),
    });
    if (brands.size === 3) break;
  }
  if (!brands.size)
    for (const name of ["LG", "Samsung", "BEKO"])
      brands.set(name.toUpperCase(), {
        name,
        source: brandLogoFor(campaign, name),
      });
  return [...brands.values()];
}

function PreviewLogo({ name, source }: { name: string; source: string }) {
  const [failedSource, setFailedSource] = React.useState("");
  return source && failedSource !== source ? (
    <img src={source} alt={name} onError={() => setFailedSource(source)} />
  ) : (
    <strong>{name}</strong>
  );
}

export function BrandLogoPreview({
  campaign,
  products,
  onChange,
}: {
  campaign: Partial<Campaign>;
  products: readonly Product[];
  onChange: (mode: BrandLogoMode) => void;
}) {
  const id = React.useId();
  const brands = previewBrands(campaign, products);
  return (
    <section
      className="cs-brand-logo-preview"
      aria-labelledby={`${id}-heading`}
    >
      <div className="cs-brand-logo-preview-heading">
        <strong id={`${id}-heading`}>{t("Brand logo appearance")}</strong>
        <BrandLogoModeSelect
          value={campaign.brandLogoMode}
          onChange={onChange}
        />
      </div>
      <div className="cs-brand-logo-preview-pages">
        {(["cover", "product"] as const).map((kind) => {
          const appearance = brandLogoAppearance(campaign, kind);
          return (
            <figure key={kind}>
              <figcaption>
                {t(kind === "cover" ? "Cover" : "Inside pages")}
              </figcaption>
              <div
                className="cs-brand-logo-preview-swatch"
                style={
                  {
                    background:
                      pageBackgroundFill(campaign, kind) ||
                      (campaign.theme === "light" ? "#f1f2f4" : "#245b89"),
                    color: appearance.color,
                    "--brand-preview-filter": appearance.filter,
                  } as React.CSSProperties
                }
              >
                {brands.map((brand) => (
                  <span key={brand.name}>
                    <PreviewLogo {...brand} />
                  </span>
                ))}
              </div>
            </figure>
          );
        })}
      </div>
      <small>
        {t(
          "Automatic uses white logos on dark backgrounds and dark gray on light backgrounds. You can change this later.",
        )}
      </small>
    </section>
  );
}

export function BrandLogoModeSelect({
  value = "auto",
  onChange,
}: {
  value?: BrandLogoMode;
  onChange: (mode: BrandLogoMode) => void;
}) {
  return (
    <label className="cs-brand-logo-mode-control">
      <span>{t("Brand logo colors")}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as BrandLogoMode)}
      >
        <option value="auto">{t("Automatic")}</option>
        <option value="white">{t("White")}</option>
        <option value="dark">{t("Dark gray")}</option>
        <option value="original">{t("Original colors")}</option>
      </select>
    </label>
  );
}
