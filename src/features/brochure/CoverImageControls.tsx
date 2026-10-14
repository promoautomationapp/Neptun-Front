import React from "react";
import { LifestyleImageEditor } from "./LifestyleImageEditor";
import { coverProducts } from "./campaignPages";
import { t } from "./i18n";
import type { Campaign, CampaignMutator } from "../../domain/models";
import { makeCoverImageLayer } from "./coverPresentation";
export function CoverImageControls({ campaign, onUpdate }: { campaign: Campaign; onUpdate: (mutate: CampaignMutator) => void }) {
  const [open, setOpen] = React.useState(false);
  const layer = campaign.pageArtworks?.cover?.find((item) => item.id === "cover-lifestyle");
  const source = layer?.image || campaign.coverImage || campaign.coverBackgroundImage || "";
  function apply(image: string) {
    onUpdate((draft) => {
      const previous = draft.pageArtworks?.cover?.find((item) => item.id === "cover-lifestyle");
      draft.coverImage = image;
      draft.pageArtworks ||= {};
      draft.pageArtworks.cover = (draft.pageArtworks.cover || []).filter((item) => item.id !== "cover-lifestyle");
      makeCoverImageLayer(draft, "cover-lifestyle");
      const item = draft.pageArtworks.cover.find((item) => item.id === "cover-lifestyle");
      if (item) Object.assign(item, previous ? { ...previous, image } : draft.showCoverBand === true
        ? { x: 0, y: 0, width: 100, height: 49, imageFit: "cover" }
        : { x: 4, y: 17, width: 92, height: 46, imageFit: "contain" });
    });
  }
  return <><button type="button" className="cs-cover-image-open" onClick={() => setOpen(true)}>{source && <img src={source} alt="" />}▧ {t("Cover image")}</button>{open && <LifestyleImageEditor context="brochure" source={source} products={coverProducts(campaign)} onApply={apply} onClose={() => setOpen(false)} />}</>;
}
