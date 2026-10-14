import React, { useState } from "react";
import type { Campaign, Product } from "../../domain/models";
import { ImageUploadButton } from "./ImageUploadButton";
import { bundleMemberText } from "./bundleMemberCopy";
import { t } from "./i18n";
import { coverProducts, splitPages } from "./campaignPages";
import { pageBackgroundContrastColor } from "./pageBackground";
import { largeBundlePanelColors } from "./largeBundleLayout";

type Props = {
  product: Product;
  campaign?: Campaign;
  onChange: (field: keyof Product, value: Product[keyof Product]) => void;
};
export function BundleOfferControls({ product, campaign, onChange }: Props) {
  const [error, setError] = useState("");
  if ((product.bundleProducts?.length || 0) < 3) return null;
  const page = campaign
    ? splitPages(campaign).find((item) =>
        item.products.some((entry) => entry.code === product.code),
      )
    : undefined;
  const onCover =
    campaign &&
    coverProducts(campaign).some((entry) => entry.code === product.code);
  const pageColor = campaign
    ? pageBackgroundContrastColor(campaign, onCover ? "cover" : "product", page)
    : undefined;
  const panelColor = largeBundlePanelColors(
    pageColor || (campaign?.theme === "light" ? "#f1f2f4" : undefined),
    product.bundlePanelColor,
  ).background;
  async function replaceLogo(file: File) {
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
      setError(t("Choose an image smaller than 12 MB."));
      return;
    }
    try {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Image could not be read"));
        reader.readAsDataURL(file);
      });
      onChange("brandLogo", image);
      setError("");
    } catch {
      setError(t("Could not read this image. Choose another file."));
    }
  }
  return (
    <details className="cs-detail-appearance" name="product-extra-settings">
      <summary>{t("Set panel and member details")}</summary>
      <p>
        {t(
          "One price covers the whole set. Move each photo, logo, saving and member details directly on the brochure.",
        )}
      </p>
      <label>
        {t("Panel color")}{" "}
        <input
          aria-label={t("Set panel color")}
          type="color"
          value={panelColor}
          onChange={(event) => onChange("bundlePanelColor", event.target.value)}
        />
      </label>
      <button
        type="button"
        onClick={() => onChange("bundlePanelColor", undefined)}
      >
        {t("Use background color")}
      </button>
      <ImageUploadButton
        label={t("Set brand logo")}
        value={product.brandLogo}
        onFile={replaceLogo}
        onRemove={() => onChange("brandLogo", undefined)}
      />
      <label>
        <input
          type="checkbox"
          checked={product.hideBrandLogo === true}
          onChange={(event) => onChange("hideBrandLogo", event.target.checked)}
        />{" "}
        {t("Hide brand logo")}
      </label>
      {product.bundleProducts?.map((member) => (
        <label
          key={member.code}
          style={{ display: "grid", gap: 6, marginTop: 12 }}
        >
          {member.name}
          <textarea
            rows={5}
            aria-label={`${t("Set member details")}: ${member.name}`}
            value={bundleMemberText(product, member)}
            onChange={(event) =>
              onChange("bundleMemberDetails", {
                ...product.bundleMemberDetails,
                [member.code]: event.target.value,
              })
            }
          />
        </label>
      ))}
      <button
        type="button"
        onClick={() => onChange("bundleMemberDetails", undefined)}
      >
        {t("Restore member details")}
      </button>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
