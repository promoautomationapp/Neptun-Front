import React from "react";
import { LifestyleImageEditor } from "./LifestyleImageEditor";
import { coverProducts } from "./campaignPages";
import { t } from "./i18n";
import type { Campaign, CampaignMutator } from "../../domain/models";
import { makeCoverImageLayer } from "./coverPresentation";
import { EditorIcon } from "./EditorIcon";
import { resolveAsset } from "../../api/client";
import "../../styles/cover-image-control.css";

export function CoverImageControls({
  campaign,
  onUpdate,
}: {
  campaign: Campaign;
  onUpdate: (mutate: CampaignMutator) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const layer = campaign.pageArtworks?.cover?.find(
    (item) => item.id === "cover-lifestyle",
  );
  const source =
    layer?.image || campaign.coverImage || campaign.coverBackgroundImage || "";
  function apply(image: string) {
    onUpdate((draft) => {
      const previous = draft.pageArtworks?.cover?.find(
        (item) => item.id === "cover-lifestyle",
      );
      draft.coverImage = image;
      draft.pageArtworks ||= {};
      draft.pageArtworks.cover = (draft.pageArtworks.cover || []).filter(
        (item) => item.id !== "cover-lifestyle",
      );
      makeCoverImageLayer(draft, "cover-lifestyle");
      const item = draft.pageArtworks.cover.find(
        (item) => item.id === "cover-lifestyle",
      );
      if (item)
        Object.assign(
          item,
          previous
            ? { ...previous, image }
            : draft.showCoverBand === true
              ? { x: 0, y: 0, width: 100, height: 49, imageFit: "cover" }
              : { x: 4, y: 17, width: 92, height: 46, imageFit: "contain" },
        );
    });
  }
  return (
    <>
      <button
        type="button"
        className="cs-cover-image-open"
        aria-label={t("Cover image")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="cs-cover-image-open-media" aria-hidden="true">
          {source ? (
            <img src={resolveAsset(source)} alt="" draggable={false} />
          ) : (
            <EditorIcon name="image" />
          )}
        </span>
        <span className="cs-cover-image-open-copy">
          <span>{t("Cover image")}</span>
          <small>
            {t(source ? "Replace or refine image" : "Upload or create image")}
          </small>
        </span>
        <svg
          className="cs-cover-image-open-arrow"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>
      {open && (
        <LifestyleImageEditor
          context="brochure"
          source={source}
          products={coverProducts(campaign)}
          onApply={apply}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
