import type { Campaign, Product } from "../../domain/models";
import { ProductCard, priceLogoSource } from "./Brochure";
import { PreviewPaper } from "../settings/SettingsPreview";
import { campaignDefaults } from "../settings/campaign-defaults";
import { resolveSettings } from "../settings/settings.schema";
import { coverProducts, splitPages } from "./campaignPages";
import {
  pageBackgroundContrastColor,
  pageBackgroundFill,
  pageBackgroundReadability,
} from "./pageBackground";
import { backgroundReadabilityStyle } from "./backgroundContrast";
import { isOctoberBrochure } from "./octoberDesign";
import { t } from "./i18n";

export function ProductDetailLivePreview({
  product,
  campaign: source,
}: {
  product: Product;
  campaign?: Campaign;
}) {
  const campaign: Campaign = source || {
    ...campaignDefaults(resolveSettings(null)),
    id: "product-preview",
    name: product.name,
    products: [product],
  };
  const kind = coverProducts(campaign).some(
    (item) => String(item.code) === String(product.code),
  )
    ? "cover"
    : "product";
  const page = splitPages(campaign).find((item) =>
    item.products.some(
      (member) => String(member.code) === String(product.code),
    ),
  );
  const background = pageBackgroundFill(campaign, kind, page);
  const color = pageBackgroundContrastColor(campaign, kind, page);
  const readability = pageBackgroundReadability(campaign, kind, page);
  return (
    <section
      className="cs-detail-live-preview"
      aria-label={t("Product preview")}
    >
      <div className="cs-detail-live-heading">
        <strong>{t("Product preview")}</strong>
        <small>{t("Changes appear here as you edit.")}</small>
      </div>
      <PreviewPaper ratio={380 / 480} aspectRatio="380 / 480" canvasWidth={380}>
        <div
          className={`brochure-page brochure-interior cs-detail-preview-canvas has-background-readability ${readability.needsSurface ? "needs-contrast-surfaces" : ""} ${readability.light ? "light" : "blue"} ${isOctoberBrochure(campaign) ? "brochure-october" : ""}`}
          style={{
            ...backgroundReadabilityStyle(readability, color),
            background,
          }}
        >
          <ProductCard
            campaign={campaign}
            product={product}
            priceLogo={priceLogoSource(campaign)}
            installments={Number(campaign.installments) || 12}
            layout={page?.layout || campaign.layout}
            light={readability.light}
            pageColor={color}
          />
        </div>
      </PreviewPaper>
    </section>
  );
}
