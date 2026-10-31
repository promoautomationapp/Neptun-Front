import "../../../src/features/studio/Studio";
import React from "react";
import { createRoot } from "react-dom/client";
import {
  CoverPage,
  ProductPage,
} from "../../../src/features/brochure/Brochure";
import {
  availableBrochurePresets,
  applyBrochurePreset,
} from "../../../src/features/brochure/brochurePresets";
import { settingsPreviewCampaign } from "../../../src/features/settings/SettingsPreview";
import { resolveSettings } from "../../../src/features/settings/settings.schema";
import { splitPages } from "../../../src/features/brochure/campaignPages";
import { setLanguage, t } from "../../../src/features/brochure/i18n";
import "../../../src/styles/campaign.css";
import "../../../src/styles/artwork-typography.css";
import "../../../src/styles/offer-default-sizing.css";
setLanguage("sq");
const settings = resolveSettings(null);
const presets = availableBrochurePresets(settings);
createRoot(document.getElementById("root")!).render(
  <main
    style={{
      padding: 24,
      background: "#eff3f7",
      display: "grid",
      gridTemplateColumns: "repeat(5,minmax(0,1fr))",
      gap: 18,
    }}
  >
    {presets.map((preset) => {
      const campaign = settingsPreviewCampaign(settings);
      applyBrochurePreset(campaign, preset);
      campaign.coverProductCodes = campaign.products
        .slice(0, 3)
        .map((p) => p.code);
      campaign.includeStoresFooter = false;
      return (
        <article key={preset.id} data-preset={preset.id}>
          <h2 style={{ fontSize: 16, color: "#1b4075", margin: "0 0 8px" }}>
            {t(preset.name)}
          </h2>
          <p
            style={{
              fontSize: 11,
              lineHeight: 1.4,
              height: 40,
              color: "#526a81",
            }}
          >
            {t(preset.description || "")}
          </p>
          <div
            style={{ position: "relative", width: "100%", aspectRatio: "4/5" }}
          >
            <CoverPage campaign={campaign} settings={settings} />
          </div>
          <p style={{ fontSize: 11, color: "#526a81", margin: "14px 0 6px" }}>
            {t("Inside pages")}
          </p>
          <div
            style={{ position: "relative", width: "100%", aspectRatio: "4/5" }}
          >
            <ProductPage
              campaign={campaign}
              settings={settings}
              page={splitPages(campaign)[0]!}
            />
          </div>
        </article>
      );
    })}
  </main>,
);
