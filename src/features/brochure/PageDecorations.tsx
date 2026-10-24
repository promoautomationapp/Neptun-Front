import React from "react";
import type { Campaign, PageLayout } from "../../domain/models";
import type { BrochurePage } from "./campaignPages";
import { pageCategoryLabel } from "./brochureLayout";
import { isAppleProduct } from "./productTypes";
import {
  CampaignAssetArtwork,
  type CampaignAssetChange,
} from "./CampaignAssetArtwork";
import { NeptunWordmark } from "./NeptunWordmark";
import { inlineText } from "./inlineText";
import { OCTOBER_ASSETS } from "./octoberDesign";
import { t } from "./i18n";

export type PageDecorationChange = (changes: Partial<PageLayout>) => void;

export function PageDecorations({
  campaign,
  page,
  onAssetChange,
  onChange,
}: {
  campaign: Campaign;
  page: BrochurePage;
  onAssetChange?: CampaignAssetChange;
  onChange?: PageDecorationChange;
}) {
  const config = {
    ...campaign.pageDecorationDefaults,
    ...campaign.pages?.[page.index],
  };
  const pageKey = `product-${page.index}`;
  const apple = page.products.length > 0 && page.products.every(isAppleProduct);
  const title = config.headerText ?? pageCategoryLabel(page.products);
  const asset = (
    key: string,
    label: string,
    children: React.ReactNode,
    className: string,
  ) => (
    <div
      className={`october-decoration ${className}`}
      onDoubleClickCapture={(event) => {
        if ((event.target as Element).closest('[contenteditable="true"]'))
          event.stopPropagation();
      }}
    >
      <CampaignAssetArtwork
        campaign={campaign}
        assetKey={`${pageKey}-${key}`}
        label={t(label)}
        onChange={onAssetChange}
        defaultWidth="100%"
      >
        {children}
      </CampaignAssetArtwork>
    </div>
  );
  return (
    <>
      {config.showHeader !== false &&
        (apple
          ? asset(
              "apple-reseller",
              "Apple Authorised Reseller",
              <img
                src={OCTOBER_ASSETS.apple}
                alt="Apple Authorised Reseller"
                draggable={false}
              />,
              "october-apple-header",
            )
          : asset(
              "category-header",
              "Category ribbon",
              <span
                className="october-category-ribbon"
                style={{
                  backgroundColor: config.headerColor || "#007dc5",
                  color: config.headerTextColor || "#ffffff",
                }}
              >
                <span
                  {...inlineText(
                    title,
                    t("Category heading"),
                    onChange
                      ? (headerText) => onChange({ headerText })
                      : undefined,
                  )}
                >
                  {title}
                </span>
              </span>,
              "october-category-header",
            ))}
      {config.showOnlineLogo !== false &&
        asset(
          "online",
          "Buy online and in store logo",
          <img
            src={OCTOBER_ASSETS.online}
            alt={t("Buy online and in store")}
            draggable={false}
          />,
          "october-online-logo",
        )}
      {page.showFooter && (
        <>
          {config.showFooterLogo !== false &&
            asset(
              "neptun",
              "NEPTUN footer logo",
              <NeptunWordmark
                campaign={campaign}
                backgroundColor={
                  page.backgroundColor ||
                  campaign.productBackgroundColor ||
                  "#e3e3e3"
                }
              />,
              "october-footer-logo",
            )}
          {config.showFooterLine !== false &&
            asset(
              "footer-line",
              "Footer line",
              <span
                className="october-footer-rule"
                style={{ backgroundColor: config.footerLineColor || "#003870" }}
              />,
              "october-footer-line",
            )}
          {page.showFooterPageNumber &&
            asset(
              "page-number",
              "Page number",
              <span
                className="october-page-number"
                style={{ color: config.footerLineColor || "#003870" }}
                {...inlineText(
                  String(config.footerNumber ?? page.index + 2),
                  t("Page number"),
                  onChange
                    ? (footerNumber) => onChange({ footerNumber })
                    : undefined,
                )}
              >
                {config.footerNumber ?? page.index + 2}
              </span>,
              "october-footer-number",
            )}
        </>
      )}
    </>
  );
}

export function PageDecorationControls({
  campaign,
  page,
  onChange,
}: {
  campaign: Campaign;
  page: BrochurePage;
  onChange: PageDecorationChange;
}) {
  const config = {
    ...campaign.pageDecorationDefaults,
    ...campaign.pages?.[page.index],
  };
  return (
    <div className="cs-page-decoration-controls">
      <label className="cs-decoration-toggle">
        <input
          type="checkbox"
          checked={page.showFooter}
          onChange={(event) => onChange({ showFooter: event.target.checked })}
        />
        {t("Show page footer")}
      </label>
      <label className="cs-decoration-toggle">
        <input
          type="checkbox"
          checked={page.showFooterPageNumber}
          onChange={(event) =>
            onChange({ showFooterPageNumber: event.target.checked })
          }
        />
        {t("Show page number")}
      </label>
      <label>
        {t("Category heading")}
        <input
          value={config.headerText ?? pageCategoryLabel(page.products)}
          onChange={(event) => onChange({ headerText: event.target.value })}
        />
      </label>
      {(
        [
          ["showHeader", "Category / Apple heading"],
          ["showOnlineLogo", "Buy online and in store logo"],
          ["showFooterLogo", "Footer logo"],
          ["showFooterLine", "Footer line"],
        ] as const
      ).map(([field, label]) => (
        <label className="cs-decoration-toggle" key={field}>
          <input
            type="checkbox"
            checked={config[field] !== false}
            onChange={(event) => onChange({ [field]: event.target.checked })}
          />
          {t(label)}
        </label>
      ))}
      <label>
        {t("Ribbon color")}
        <input
          type="color"
          value={config.headerColor || "#007dc5"}
          onChange={(event) => onChange({ headerColor: event.target.value })}
        />
      </label>
      <label>
        {t("Ribbon text color")}
        <input
          type="color"
          value={config.headerTextColor || "#ffffff"}
          onChange={(event) =>
            onChange({ headerTextColor: event.target.value })
          }
        />
      </label>
      <label>
        {t("Footer line color")}
        <input
          type="color"
          value={config.footerLineColor || "#003870"}
          onChange={(event) =>
            onChange({ footerLineColor: event.target.value })
          }
        />
      </label>
      <label>
        {t("Page number")}
        <input
          value={String(config.footerNumber ?? page.index + 2)}
          onChange={(event) => onChange({ footerNumber: event.target.value })}
        />
      </label>
    </div>
  );
}
