import "../../../src/features/studio/Studio";
import React from "react";
import { createRoot } from "react-dom/client";
import type { Campaign } from "../../../src/domain/models";
import { CoverPage } from "../../../src/features/brochure/Brochure";
import {
  applyBrochurePreset,
  availableBrochurePresets,
} from "../../../src/features/brochure/brochurePresets";
import { settingsPreviewCampaign } from "../../../src/features/settings/SettingsPreview";
import { resolveSettings } from "../../../src/features/settings/settings.schema";
import { setLanguage } from "../../../src/features/brochure/i18n";
import "../../../src/styles/campaign.css";
import "../../../src/styles/artwork-typography.css";
import "../../../src/styles/offer-default-sizing.css";

setLanguage("sq");
const settings = resolveSettings(null);
const photograph = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="760"><rect width="1080" height="760" fill="#ce6d24"/><path d="M0 600 300 140 650 620 900 80 1080 460V760H0Z" fill="#794121"/><circle cx="800" cy="180" r="75" fill="#eeba62"/></svg>',
)}`;
const campaigns = ["neptun-october", "neptun-uuu-gray"].map((id) => {
  const campaign = settingsPreviewCampaign(settings);
  applyBrochurePreset(
    campaign,
    availableBrochurePresets(settings).find((preset) => preset.id === id)!,
  );
  campaign.coverImage = photograph;
  campaign.coverProductCodes = campaign.products.slice(0, 2).map((p) => p.code);
  campaign.includeStoresFooter = false;
  return campaign;
});
function Cover({ campaign, width }: { campaign: Campaign; width: number }) {
  return (
    <div style={{ width, position: "relative", aspectRatio: "4/5" }}>
      <CoverPage campaign={campaign} settings={settings} />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <main
    style={{ padding: 24, background: "#eff3f7", display: "grid", gap: 24 }}
  >
    {campaigns.map((campaign) => (
      <article
        key={campaign.brochurePresetId}
        data-ribbon-preset={campaign.brochurePresetId}
        style={{ display: "flex", alignItems: "start", gap: 24 }}
      >
        <Cover campaign={campaign} width={720} />
        <Cover campaign={campaign} width={280} />
      </article>
    ))}
    <article data-custom-ribbon>
      <Cover
        width={720}
        campaign={{
          ...campaigns[1]!,
          coverElementPlacements: {
            "campaign-ribbon": { x: 1, y: 40, width: 95, height: 15 },
            band: { x: 3, y: 35, width: 48, height: 24 },
            message: { x: 50, y: 44, width: 40, height: 6 },
          },
        }}
      />
    </article>
  </main>,
);
