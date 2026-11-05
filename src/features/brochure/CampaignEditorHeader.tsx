import React from "react";
import type { Campaign } from "../../domain/models";
import { CampaignStatus } from "../campaigns/CampaignStatus";
import { NavIcon } from "../studio/NavIcon";
import { t } from "./i18n";
import "../../styles/campaign-editor-header.css";

export function CampaignEditorHeader({
  campaign,
  pageCount,
  now,
  onAllCampaigns,
  onNewCampaign,
  onMakeSocial,
  children,
}: {
  campaign: Campaign;
  pageCount: number;
  now?: Date;
  onAllCampaigns: () => void;
  onNewCampaign: () => void;
  onMakeSocial?: () => void;
  children?: React.ReactNode;
}) {
  const dates =
    campaign.startDate && campaign.endDate
      ? campaign.startDate === campaign.endDate
        ? campaign.startDate
        : `${campaign.startDate} — ${campaign.endDate}`
      : campaign.startDate || campaign.endDate;
  return (
    <header className="cs-editor-hero cs-editor-header">
      <div className="cs-editor-hero-actions">
        <nav
          className="cs-editor-breadcrumbs"
          aria-label={t("Campaign navigation")}
        >
          <button type="button" onClick={onAllCampaigns}>
            ← {t("All campaigns")}
          </button>
          {campaign.type && (
            <>
              <span aria-hidden="true">/</span>
              <span>{t(campaign.type)}</span>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span aria-current="page" title={campaign.name}>
            {campaign.name}
          </span>
        </nav>
        <button type="button" className="cs-start-new" onClick={onNewCampaign}>
          ＋ {t("New campaign")}
        </button>
      </div>
      <div className="cs-editor-campaign-row">
        <div className="cs-editor-campaign-summary">
          <div className="cs-editor-campaign-identity">
            <h1>{campaign.name}</h1>
            <div className="cs-editor-progress">
              <CampaignStatus campaign={campaign} now={now} />
            </div>
          </div>
          <p className="cs-editor-campaign-meta">
            {dates && <span>{dates}</span>}
            <span>
              {campaign.products.length} {t("products")}
            </span>
            <span>
              {pageCount} {t("brochure pages")}
            </span>
            <span className="cs-editor-saved">
              <span aria-hidden="true">✓</span> {t("Saved for the team")}
            </span>
          </p>
        </div>
        <div className="cs-editor-campaign-actions">
          {onMakeSocial && (
            <button
              type="button"
              className="cs-social-shortcut"
              title={t("From this brochure")}
              onClick={onMakeSocial}
            >
              <NavIcon name="social" size={15} />
              {t("Create social post")}
            </button>
          )}
          {children}
        </div>
      </div>
    </header>
  );
}
