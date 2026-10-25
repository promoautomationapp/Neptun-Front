import React from "react";
import type { Campaign } from "../../domain/models";
import { REVIEW_STATUS } from "../brochure/ReviewPanel";
import { t } from "../brochure/i18n";
import { campaignValidity } from "./campaignValidity";
import "./campaign-status.css";

/** Offer dates never replace the saved review workflow status. */
export function CampaignStatus({
  campaign,
  now,
  surface = "editor",
}: {
  campaign: Pick<Campaign, "status" | "startDate" | "endDate" | "disabledAt">;
  now?: Date;
  surface?: "editor" | "library";
}) {
  const status = campaign.status || "in_progress";
  const label = t(
    Object.entries(REVIEW_STATUS).find(([key]) => key === status)?.[1] ||
      "In progress",
  );
  const disabled = Boolean(campaign.disabledAt);
  return (
    <>
      <span
        className={`cs-workflow-status ${surface === "library" ? "cs-campaign-status" : status === "completed" ? "completed" : "progress"} status-${disabled ? "disabled" : status}`}
        aria-label={disabled ? undefined : `${t("Workflow status")}: ${label}`}
      >
        {disabled ? t("Deleted") : label}
      </span>
      {!disabled && campaignValidity(campaign, now) === "expired" && (
        <span className="cs-campaign-validity status-expired">
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          {t("Offer period ended")}
        </span>
      )}
    </>
  );
}
