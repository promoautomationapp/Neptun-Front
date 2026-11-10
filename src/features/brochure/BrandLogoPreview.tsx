import React from "react";
import type { Campaign, Product } from "../../domain/models";
import { brandLogoFor } from "./brandLogos";
import { brandLogoAppearance, type BrandLogoMode } from "./brandLogoAppearance";
import { pageBackgroundFill } from "./pageBackground";
import { ColorField } from "./ColorField";
import { BrandLogoTintFilter } from "./BrandLogoTintFilter";
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
    if (brands.size === 2) break;
  }
  if (!brands.size)
    for (const name of ["LG", "Samsung"])
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

export interface BrandLogoAppearanceChanges {
  brandLogoMode?: BrandLogoMode;
  brandLogoColor?: string;
}

/** A global choice replaces saved page colors without changing other page styles. */
export function applyBrandLogoAppearance(
  campaign: Campaign,
  changes: BrandLogoAppearanceChanges,
) {
  Object.assign(campaign, changes);
  for (const appearance of Object.values(campaign.pageAppearances || {}))
    delete appearance.brandColor;
}

export function BrandLogoColorControl({
  campaign,
  onChange,
}: {
  campaign: Partial<Campaign>;
  onChange: (changes: BrandLogoAppearanceChanges) => void;
}) {
  const appearance = brandLogoAppearance(campaign, "product");
  const automatic =
    !campaign.brandLogoColor &&
    (!campaign.brandLogoMode || campaign.brandLogoMode === "auto");
  const original =
    !campaign.brandLogoColor && campaign.brandLogoMode === "original";
  return (
    <div className="cs-brand-logo-color-control">
      <ColorField
        compact
        label={t("Brand logo colors")}
        value={campaign.brandLogoColor || appearance.color}
        colors={["#ffffff", "#343534", "#000000", "#1c4075", "#ef4023"]}
        onChange={(brandLogoColor) =>
          onChange({ brandLogoColor, brandLogoMode: "auto" })
        }
      />
      <button
        type="button"
        aria-pressed={automatic}
        onClick={() =>
          onChange({ brandLogoColor: undefined, brandLogoMode: "auto" })
        }
      >
        {t("Automatic")}
      </button>
      <button
        type="button"
        aria-pressed={original}
        onClick={() =>
          onChange({ brandLogoColor: undefined, brandLogoMode: "original" })
        }
      >
        {t("Original colors")}
      </button>
    </div>
  );
}

export function BrandLogoPreview({
  campaign,
  products,
  onChange,
}: {
  campaign: Partial<Campaign>;
  products: readonly Product[];
  onChange: (changes: BrandLogoAppearanceChanges) => void;
}) {
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const brands = previewBrands(campaign, products);
  return (
    <section
      className="cs-brand-logo-preview"
      aria-labelledby={`${id}-heading`}
    >
      <div className="cs-brand-logo-preview-heading">
        <strong id={`${id}-heading`}>{t("Brand logo appearance")}</strong>
        <BrandLogoColorControl campaign={campaign} onChange={onChange} />
      </div>
      <div className="cs-brand-logo-preview-pages">
        {(["cover", "product"] as const).map((kind) => {
          const filterId = `brand-preview-${id}-${kind}`;
          const appearance = brandLogoAppearance(campaign, kind, filterId);
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
                <BrandLogoTintFilter id={filterId} color={appearance.color} />
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
    </section>
  );
}
